import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
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
}
