import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../services/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as argon2 from "argon2";

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
  verifyAsync: jest.fn(),
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
        user: {
          isActive: true,
          isBanned: false,
          id: "u1",
          role: "USER",
          createdAt: new Date(),
        },
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

  describe("login with 2FA enabled", () => {
    const twoFactorUser = {
      id: "u1",
      email: "a@b.com",
      username: "anon",
      role: "USER",
      passwordHash: "",
      isActive: true,
      isBanned: false,
      twoFactorAuth: true,
      twoFactorSecret: "abcdef1234567890abcdef1234567890abcdef12",
      twoFactorBackupCodes: [],
    };

    it("should return a 2FA challenge instead of tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...twoFactorUser,
        passwordHash: await argon2.hash("pw"),
      });
      const result = await service.login("a@b.com", "pw");
      expect(result).toEqual({
        two_factor_required: true,
        challenge_token: "test-token",
      });
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { sub: "u1", purpose: "2fa-pending" },
        expect.objectContaining({ expiresIn: "5m" }),
      );
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("verifyTwoFactorChallenge", () => {
    const twoFactorUser = {
      id: "u1",
      email: "a@b.com",
      username: "anon",
      role: "USER",
      isActive: true,
      isBanned: false,
      twoFactorAuth: true,
      twoFactorSecret: "abcdef1234567890abcdef1234567890abcdef12",
      twoFactorBackupCodes: [],
      createdAt: new Date(),
    };

    it("should reject an invalid challenge token", async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error("bad token"));
      await expect(
        service.verifyTwoFactorChallenge("bogus", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject a token without the 2fa purpose", async () => {
      mockJwt.verifyAsync.mockResolvedValue({ sub: "u1" });
      await expect(
        service.verifyTwoFactorChallenge("tok", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should accept a valid backup code and consume it", async () => {
      const crypto = await import("crypto");
      const backupHash = crypto
        .createHash("sha256")
        .update("abcd1234")
        .digest("hex");
      mockJwt.verifyAsync.mockResolvedValue({
        sub: "u1",
        purpose: "2fa-pending",
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...twoFactorUser,
        twoFactorBackupCodes: [backupHash],
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.verifyTwoFactorChallenge("tok", "abcd-1234");
      expect(result).toHaveProperty("access_token", "test-token");
      // The used code is removed from the stored set.
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { twoFactorBackupCodes: [] },
        }),
      );
    });

    it("should reject a wrong code", async () => {
      mockJwt.verifyAsync.mockResolvedValue({
        sub: "u1",
        purpose: "2fa-pending",
      });
      mockPrisma.user.findUnique.mockResolvedValue(twoFactorUser);
      await expect(
        service.verifyTwoFactorChallenge("tok", "000000"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("disable2FA", () => {
    it("should reject a wrong password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        passwordHash: await argon2.hash("correct"),
        twoFactorAuth: true,
      });
      await expect(service.disable2FA("u1", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should clear 2FA fields and revoke refresh tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        passwordHash: await argon2.hash("correct"),
        twoFactorAuth: true,
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.disable2FA("u1", "correct");
      expect(result).toEqual({ disabled: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: {
          twoFactorAuth: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
      });
    });
  });
});
