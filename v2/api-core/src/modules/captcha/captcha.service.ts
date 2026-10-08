import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";

const CAPTCHA_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class CaptchaService {
  private redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get("REDIS_HOST", "redis"),
      port: this.config.get("REDIS_PORT", 6379),
      password: this.config.get("REDIS_PASSWORD"),
      db: this.config.get("REDIS_DB", 0),
    });
  }

  async generate(_ip: string): Promise<{ id: string; imageBase64: string }> {
    const id = randomBytes(16).toString("hex");
    const solution = randomBytes(3).toString("hex").toUpperCase();
    const hashedSolution = createHash("sha256").update(solution).digest("hex");

    await this.redis.setex(
      `captcha:${id}`,
      CAPTCHA_TTL_SECONDS,
      hashedSolution,
    );

    const imageBase64 = this.renderCaptchaImage(solution);

    return { id, imageBase64 };
  }

  async verify(id: string, solution: string): Promise<boolean> {
    const key = `captcha:${id}`;
    const stored = await this.redis.get(key);

    if (!stored) {
      throw new BadRequestException("Invalid or expired captcha");
    }

    const hashedInput = createHash("sha256").update(solution).digest("hex");
    if (hashedInput !== stored) {
      throw new BadRequestException("Incorrect captcha solution");
    }

    await this.redis.del(key);
    return true;
  }

  async cleanup(): Promise<{ message: string }> {
    return { message: "Redis TTL handles cleanup automatically" };
  }

  private renderCaptchaImage(text: string): string {
    const width = 200;
    const height = 60;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    svg += `<rect width="100%" height="100%" fill="#f0f0f0"/>`;

    for (let i = 0; i < 5; i++) {
      const x1 = Math.floor(Math.random() * width);
      const y1 = Math.floor(Math.random() * height);
      const x2 = Math.floor(Math.random() * width);
      const y2 = Math.floor(Math.random() * height);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ccc" stroke-width="1"/>`;
    }

    for (let i = 0; i < text.length; i++) {
      const x = 20 + i * 28;
      const y = 35 + Math.floor(Math.random() * 10) - 5;
      const rotate = Math.floor(Math.random() * 30) - 15;
      svg += `<text x="${x}" y="${y}" font-size="28" font-family="monospace" fill="#333" transform="rotate(${rotate},${x},${y})">${text[i]}</text>`;
    }

    svg += `</svg>`;
    return Buffer.from(svg).toString("base64");
  }
}
