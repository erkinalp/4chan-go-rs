import { Test, TestingModule } from "@nestjs/testing";
import { CaptchaService } from "./captcha.service";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";

const mockRedis = {
  on: jest.fn(),
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: 6379,
    };
    return map[key] ?? fallback;
  }),
};

describe("CaptchaService", () => {
  let service: CaptchaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptchaService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<CaptchaService>(CaptchaService);
  });

  describe("generate", () => {
    it("should store a sha256 solution in redis with a 5-minute TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");
      const result = await service.generate("1.2.3.4");

      expect(result.id).toMatch(/^[0-9a-f]{32}$/);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      const [key, ttl, hashed] = mockRedis.setex.mock.calls[0];
      expect(key).toBe(`captcha:${result.id}`);
      expect(ttl).toBe(300);
      expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return a base64 SVG image", async () => {
      mockRedis.setex.mockResolvedValue("OK");
      const result = await service.generate("1.2.3.4");
      const svg = Buffer.from(result.imageBase64, "base64").toString("utf8");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    });
  });

  describe("verify", () => {
    it("should return true and delete the key for a correct solution", async () => {
      const solution = "A1B2C3";
      const hashed = createHash("sha256").update(solution).digest("hex");
      mockRedis.get.mockResolvedValue(hashed);
      mockRedis.del.mockResolvedValue(1);

      await expect(service.verify("cap1", solution)).resolves.toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("captcha:cap1");
    });

    it("should throw BadRequestException for an unknown or expired id", async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(service.verify("cap1", "ABC")).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for a wrong solution", async () => {
      const hashed = createHash("sha256").update("RIGHT").digest("hex");
      mockRedis.get.mockResolvedValue(hashed);
      await expect(service.verify("cap1", "WRONG")).rejects.toThrow(
        BadRequestException,
      );
      // A failed attempt must not consume the captcha.
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should report TTL-managed cleanup", async () => {
      const result = await service.cleanup();
      expect(result.message).toContain("TTL");
    });
  });
});
