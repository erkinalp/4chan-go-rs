import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, createHmac, randomBytes } from "crypto";
import { PrismaService } from "../../services/prisma/prisma.service";
import { User } from "@prisma/client";

// `purpose` claim separating a pending 2FA challenge token from a real
// access token. JwtStrategy rejects any token carrying a non-"access"
// purpose, so a challenge token can never be used as a session token.
const TWO_FACTOR_PURPOSE = "2fa-pending";

const BACKUP_CODE_COUNT = 8;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.isBanned) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (user.twoFactorAuth) {
      const challengeToken = this.jwt.sign(
        { sub: user.id, purpose: TWO_FACTOR_PURPOSE },
        {
          expiresIn: this.config.get("JWT_2FA_CHALLENGE_EXPIRES_IN", "5m"),
        },
      );
      return { two_factor_required: true, challenge_token: challengeToken };
    }
    return this.issueTokens(user);
  }

  // Completes a login that was paused for 2FA: verifies the challenge
  // token minted by `login`, then the TOTP code or a backup code.
  async verifyTwoFactorChallenge(challengeToken: string, code: string) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(challengeToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired 2FA challenge");
    }
    if (payload.purpose !== TWO_FACTOR_PURPOSE || !payload.sub) {
      throw new UnauthorizedException("Invalid 2FA challenge");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      !user.isActive ||
      user.isBanned ||
      !user.twoFactorAuth ||
      !user.twoFactorSecret
    ) {
      throw new UnauthorizedException("Invalid 2FA challenge");
    }

    if (!this.verifyTOTP(user.twoFactorSecret, code)) {
      const consumed = await this.consumeBackupCode(user, code);
      if (!consumed) {
        throw new UnauthorizedException("Invalid 2FA code");
      }
    }

    return this.issueTokens(user);
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get("JWT_REFRESH_SECRET"),
      expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", "30d"),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (!stored.user.isActive || stored.user.isBanned) {
      throw new UnauthorizedException("Account unavailable");
    }
    const payload = { sub: stored.user.id, role: stored.user.role };
    const accessToken = this.jwt.sign(payload);
    return { access_token: accessToken };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
    return { message: "Logged out" };
  }

  async register(username: string, email: string, password: string) {
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: { username, email, passwordHash },
    });
    return { id: user.id, username: user.username, role: user.role };
  }

  async enable2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    if (user.twoFactorAuth) {
      throw new BadRequestException("2FA is already enabled");
    }

    const secret = randomBytes(20).toString("hex");
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const otpauthUrl = `otpauth://totp/4chan:${user.email}?secret=${this.hexToBase32(secret)}&issuer=4chan`;
    return { secret: this.hexToBase32(secret), otpauthUrl };
  }

  // Confirms the pending secret and activates 2FA. On first activation the
  // plaintext backup codes are returned exactly once; only their hashes are
  // stored.
  async verify2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException("2FA not set up");
    }

    const isValid = this.verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      throw new BadRequestException("Invalid 2FA code");
    }

    if (!user.twoFactorAuth) {
      const backupCodes = this.generateBackupCodes();
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorAuth: true,
          twoFactorBackupCodes: backupCodes.map(hashBackupCode),
        },
      });
      return { verified: true, backup_codes: backupCodes };
    }

    return { verified: true };
  }

  async disable2FA(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid password");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorAuth: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });
    // Invalidate all sessions; the next login only needs the password.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { disabled: true };
  }

  async regenerateBackupCodes(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorAuth) {
      throw new BadRequestException("2FA is not enabled");
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid password");
    }

    const backupCodes = this.generateBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: backupCodes.map(hashBackupCode) },
    });
    return { backup_codes: backupCodes };
  }

  private async consumeBackupCode(user: User, code: string): Promise<boolean> {
    const hashed = hashBackupCode(code);
    const remaining = (user.twoFactorBackupCodes ?? []).filter(
      (stored) => stored !== hashed,
    );
    if (remaining.length === (user.twoFactorBackupCodes ?? []).length) {
      return false;
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: remaining },
    });
    return true;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const raw = randomBytes(4).toString("hex");
      codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
    }
    return codes;
  }

  private verifyTOTP(hexSecret: string, code: string): boolean {
    const timeStep = 30;
    const now = Math.floor(Date.now() / 1000);
    for (const offset of [-1, 0, 1]) {
      const counter = Math.floor(now / timeStep + offset);
      const counterBuf = Buffer.alloc(8);
      counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
      counterBuf.writeUInt32BE(counter >>> 0, 4);

      const hmac = createHmac("sha1", Buffer.from(hexSecret, "hex"));
      hmac.update(counterBuf);
      const hash = hmac.digest();

      const offset2 = hash[hash.length - 1] & 0x0f;
      const truncated =
        ((hash[offset2] & 0x7f) << 24) |
        ((hash[offset2 + 1] & 0xff) << 16) |
        ((hash[offset2 + 2] & 0xff) << 8) |
        (hash[offset2 + 3] & 0xff);

      const otp = (truncated % 1000000).toString().padStart(6, "0");
      if (otp === code) return true;
    }
    return false;
  }

  private hexToBase32(hex: string): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bytes = Buffer.from(hex, "hex");
    let bits = "";
    for (const byte of bytes) {
      bits += byte.toString(2).padStart(8, "0");
    }
    let result = "";
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, "0");
      result += alphabet[parseInt(chunk, 2)];
    }
    return result;
  }
}

function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}
