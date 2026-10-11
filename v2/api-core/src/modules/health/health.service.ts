import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../services/prisma/prisma.service";
import Redis from "ioredis";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.config.get("REDIS_HOST", "redis"),
      port: this.config.get("REDIS_PORT", 6379),
      password: this.config.get("REDIS_PASSWORD"),
      db: this.config.get("REDIS_DB", 0),
      lazyConnect: true,
    });
    // Prevent ioredis 'error' events from crashing the process unhandled.
    this.redis.on("error", (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const result: {
      status: string;
      database: string;
      redis: string;
      timestamp: string;
    } = {
      status: "ok",
      database: "connected",
      redis: "connected",
      timestamp: new Date().toISOString(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      result.status = "degraded";
      result.database = "disconnected";
    }

    try {
      await this.redis.ping();
    } catch {
      result.status = "degraded";
      result.redis = "disconnected";
    }

    return result;
  }
}
