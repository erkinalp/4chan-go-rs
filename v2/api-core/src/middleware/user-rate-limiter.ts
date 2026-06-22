import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import Redis from "ioredis";

interface UserClaims {
  user_id: string;
  role: string;
  created_at: number;
  exp: number;
  iat: number;
}

@Injectable()
export class UserRateLimiterInterceptor implements NestInterceptor {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get("REDIS_HOST", "redis"),
      port: this.configService.get("REDIS_PORT", 6379),
      password: this.configService.get("REDIS_PASSWORD"),
      db: this.configService.get("REDIS_DB", 0),
    });
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const authHeader = request.headers.authorization;
    let userInfo: UserClaims | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const jwtSecret = this.configService.get("JWT_SECRET");
        userInfo = jwt.verify(token, jwtSecret) as UserClaims;
      } catch (_e) {}
    }

    if (userInfo) {
      await this.checkUserRateLimit(userInfo, response);
    } else {
      await this.checkIPRateLimit(request, response);
    }

    return next.handle();
  }

  private async checkUserRateLimit(
    userInfo: UserClaims,
    response: Response,
  ): Promise<void> {
    const currentTime = new Date();
    const windowSeconds = 60;
    const maxRequests = 100;

    const blockKey = `rate_limit:block:user:${userInfo.user_id}`;

    const blocked = await this.redis.exists(blockKey);
    if (blocked) {
      await this.redis.expire(blockKey, windowSeconds);
      throw new HttpException(
        {
          error: "Rate limit exceeded",
          message:
            "User blocked due to rate limit violation - block extended for full window",
          retry_after: windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const createdAt = new Date(userInfo.created_at * 1000);
    const windowStart = this.calculateUserWindowStart(
      currentTime,
      createdAt,
      windowSeconds,
    );
    const countKey = `rate_limit:count:user:${userInfo.user_id}:${Math.floor(windowStart.getTime() / 1000)}`;

    const currentCount = parseInt((await this.redis.get(countKey)) || "0");
    const newCount = currentCount + 1;

    if (newCount > maxRequests) {
      await this.redis.setex(blockKey, windowSeconds, "blocked");
      throw new HttpException(
        {
          error: "Rate limit exceeded",
          message: "Request limit exceeded, user blocked for full window",
          limit: maxRequests,
          window: windowSeconds,
          current_count: newCount,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const windowEnd = new Date(windowStart.getTime() + windowSeconds * 1000);
    const ttl = Math.ceil((windowEnd.getTime() - currentTime.getTime()) / 1000);
    await this.redis.setex(countKey, ttl, newCount.toString());

    response.setHeader("X-RateLimit-Type", "user");
    response.setHeader("X-RateLimit-Limit", maxRequests.toString());
    response.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - newCount).toString(),
    );
    response.setHeader(
      "X-RateLimit-Reset",
      Math.floor(windowEnd.getTime() / 1000).toString(),
    );
  }

  private async checkIPRateLimit(
    request: Request,
    response: Response,
  ): Promise<void> {
    const ip = request.ip || request.connection.remoteAddress || "unknown";
    const currentTime = new Date();
    const windowSeconds = 60;
    const maxRequests = 50;

    const blockKey = `rate_limit:block:ip:${ip}`;

    const blocked = await this.redis.exists(blockKey);
    if (blocked) {
      await this.redis.expire(blockKey, windowSeconds);
      throw new HttpException(
        {
          error: "Rate limit exceeded",
          message:
            "IP blocked due to rate limit violation - block extended for full window",
          retry_after: windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const windowStart =
      Math.floor(currentTime.getTime() / 1000 / windowSeconds) * windowSeconds;
    const countKey = `rate_limit:count:ip:${ip}:${windowStart}`;

    const currentCount = parseInt((await this.redis.get(countKey)) || "0");
    const newCount = currentCount + 1;

    if (newCount > maxRequests) {
      await this.redis.setex(blockKey, windowSeconds, "blocked");
      throw new HttpException(
        {
          error: "Rate limit exceeded",
          message: "Request limit exceeded, IP blocked for full window",
          limit: maxRequests,
          window: windowSeconds,
          current_count: newCount,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const windowEndTimestamp = windowStart + windowSeconds;
    const ttl = windowEndTimestamp - Math.floor(currentTime.getTime() / 1000);
    await this.redis.setex(countKey, ttl, newCount.toString());

    response.setHeader("X-RateLimit-Type", "ip");
    response.setHeader("X-RateLimit-Limit", maxRequests.toString());
    response.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - newCount).toString(),
    );
    response.setHeader("X-RateLimit-Reset", windowEndTimestamp.toString());
  }

  private calculateUserWindowStart(
    currentTime: Date,
    createdAt: Date,
    windowSeconds: number,
  ): Date {
    const timeSinceCreation = currentTime.getTime() - createdAt.getTime();
    const windowsSinceCreation = Math.floor(
      timeSinceCreation / (windowSeconds * 1000),
    );
    return new Date(
      createdAt.getTime() + windowsSinceCreation * windowSeconds * 1000,
    );
  }
}
