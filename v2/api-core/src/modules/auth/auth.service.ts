import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHmac, randomBytes } from "crypto";
import { PrismaService } from "../../services/prisma/prisma.service";

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
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
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
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth: true },
      });
    }

    return { verified: true };
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
