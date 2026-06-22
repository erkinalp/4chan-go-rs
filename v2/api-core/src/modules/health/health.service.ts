import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: "degraded",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
