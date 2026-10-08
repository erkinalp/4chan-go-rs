import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../services/prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: { sub: string; role: string; purpose?: string }) {
    // Tokens minted for a different purpose (e.g. pending 2FA challenges)
    // must never authenticate a request.
    if (payload.purpose && payload.purpose !== "access") {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        isBanned: true,
      },
    });
    if (!user || !user.isActive || user.isBanned) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
