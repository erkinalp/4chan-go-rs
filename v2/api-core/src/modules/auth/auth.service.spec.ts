import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../services/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue("test-token"),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    const map: Record<string, string> = {
      JWT_REFRESH_SECRET: "refresh-secret",
      JWT_REFRESH_EXPIRES_IN: "30d",
    };
    return map[key] ?? fallback;
  }),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("should create a user and return id, username, role", async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: "u1",
        username: "anon",
        role: "USER",
      });
      const result = await service.register("anon", "a@b.com", "password1");
      expect(result).toEqual({ id: "u1", username: "anon", role: "USER" });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should throw UnauthorizedException for unknown email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login("x@y.com", "pw")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for banned user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        passwordHash: "hashed",
        isActive: true,
        isBanned: true,
      });
      await expect(service.login("a@b.com", "pw")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("refresh", () => {
    it("should throw for expired token", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: "tok",
        expiresAt: new Date("2000-01-01"),
        user: { isActive: true, isBanned: false, id: "u1", role: "USER" },
      });
      await expect(service.refresh("tok")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should return new access token for valid refresh", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: "tok",
        expiresAt: futureDate,
        user: { isActive: true, isBanned: false, id: "u1", role: "USER" },
      });
      const result = await service.refresh("tok");
      expect(result).toEqual({ access_token: "test-token" });
    });
  });

  describe("logout", () => {
    it("should delete refresh tokens", async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.logout("tok");
      expect(result).toEqual({ message: "Logged out" });
    });
  });

  describe("enable2FA", () => {
    it("should throw if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.enable2FA("u1")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw if 2FA already enabled", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        twoFactorAuth: true,
      });
      await expect(service.enable2FA("u1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should return secret and otpauthUrl", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
        twoFactorAuth: false,
      });
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.enable2FA("u1");
      expect(result.secret).toBeDefined();
      expect(result.otpauthUrl).toContain("otpauth://totp/4chan:a@b.com");
    });
  });

  describe("verify2FA", () => {
    it("should throw if 2FA not set up", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        twoFactorSecret: null,
      });
      await expect(service.verify2FA("u1", "123456")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw for invalid code", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        twoFactorSecret: "abcdef1234567890abcdef1234567890abcdef12",
        twoFactorAuth: false,
      });
      await expect(service.verify2FA("u1", "000000")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
