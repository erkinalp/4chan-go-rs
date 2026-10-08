import { Test, TestingModule } from "@nestjs/testing";
import { HealthService } from "./health.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../services/prisma/prisma.service";

const mockRedis = {
  ping: jest.fn(),
};

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: 6379,
    };
    return map[key] ?? fallback;
  }),
};

describe("HealthService", () => {
  let service: HealthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<HealthService>(HealthService);
  });

  describe("check", () => {
    it("should return ok status with an ISO timestamp", () => {
      const result = service.check();
      expect(result.status).toBe("ok");
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe("ready", () => {
    it("should report connected when database and redis respond", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await service.ready();
      expect(result.status).toBe("ok");
      expect(result.database).toBe("connected");
      expect(result.redis).toBe("connected");
    });

    it("should degrade when the database check fails", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await service.ready();
      expect(result.status).toBe("degraded");
      expect(result.database).toBe("disconnected");
      expect(result.redis).toBe("connected");
    });

    it("should degrade when redis fails", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockRedis.ping.mockRejectedValue(new Error("timeout"));

      const result = await service.ready();
      expect(result.status).toBe("degraded");
      expect(result.database).toBe("connected");
      expect(result.redis).toBe("disconnected");
    });

    it("should degrade when both dependencies fail", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("down"));
      mockRedis.ping.mockRejectedValue(new Error("down"));

      const result = await service.ready();
      expect(result.status).toBe("degraded");
      expect(result.database).toBe("disconnected");
      expect(result.redis).toBe("disconnected");
    });
  });
});
