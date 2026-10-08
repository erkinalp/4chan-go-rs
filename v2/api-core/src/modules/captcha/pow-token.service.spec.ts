import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { PowTokenService, hasLeadingZeroBits } from "./pow-token.service";

const redisStore = new Map<string, string>();
const mockRedis = {
  setex: jest.fn((key: string, _ttl: number, value: string) => {
    redisStore.set(key, value);
    return Promise.resolve("OK");
  }),
  get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
  getdel: jest.fn((key: string) => {
    const value = redisStore.get(key) ?? null;
    redisStore.delete(key);
    return Promise.resolve(value);
  }),
};

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn(() => mockRedis),
}));

const mockConfig = {
  get: jest.fn((key: string, fallback?: number) => {
    const map: Record<string, number> = {
      POW_DIFFICULTY_BITS: 8, // keep tests fast
      POW_CHALLENGE_TTL_SECONDS: 300,
      POW_TOKEN_TTL_SECONDS: 600,
    };
    return map[key] ?? fallback;
  }),
};

describe("PowTokenService", () => {
  let service: PowTokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisStore.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PowTokenService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<PowTokenService>(PowTokenService);
  });

  const solve = (challenge: string, bits: number): string => {
    for (let i = 0; ; i++) {
      const nonce = i.toString(16);
      const digest = createHash("sha256")
        .update(`${challenge}:${nonce}`)
        .digest();
      if (hasLeadingZeroBits(digest, bits)) return nonce;
    }
  };

  describe("issueChallenge", () => {
    it("stores the challenge in Redis and returns it", async () => {
      const result = await service.issueChallenge();
      expect(result.challenge_id).toHaveLength(32);
      expect(result.challenge).toHaveLength(32);
      expect(result.algorithm).toBe("sha256");
      expect(result.difficulty_bits).toBe(8);
      expect(redisStore.get(`pow:challenge:${result.challenge_id}`)).toBe(
        result.challenge,
      );
    });
  });

  describe("redeemChallenge", () => {
    it("issues a token for a valid solution", async () => {
      const { challenge_id, challenge } = await service.issueChallenge();
      const nonce = solve(challenge, 8);
      const result = await service.redeemChallenge(challenge_id, nonce);
      expect(result.token).toBeDefined();
      expect(result.expires_in).toBe(600);
      expect(redisStore.get(`pow:token:${result.token}`)).toBe("1");
    });

    it("rejects an unknown challenge", async () => {
      await expect(
        service.redeemChallenge("does-not-exist", "0"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an insufficient solution and consumes the challenge", async () => {
      const { challenge_id } = await service.issueChallenge();
      await expect(
        service.redeemChallenge(challenge_id, "not-a-solution"),
      ).rejects.toThrow(BadRequestException);
      // Single-use: a second attempt on the same challenge fails.
      await expect(service.redeemChallenge(challenge_id, "0")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("verifyPowToken", () => {
    it("consumes a valid token exactly once (replay protection)", async () => {
      const { challenge_id, challenge } = await service.issueChallenge();
      const { token } = await service.redeemChallenge(
        challenge_id,
        solve(challenge, 8),
      );
      await expect(service.verifyPowToken(token)).resolves.toBe(true);
      await expect(service.verifyPowToken(token)).resolves.toBe(false);
    });

    it("returns false for unknown or empty tokens", async () => {
      await expect(service.verifyPowToken("bogus")).resolves.toBe(false);
      await expect(service.verifyPowToken("")).resolves.toBe(false);
    });
  });

  describe("hasLeadingZeroBits", () => {
    it("counts leading zero bits correctly", () => {
      expect(hasLeadingZeroBits(Buffer.from([0x00, 0xff]), 8)).toBe(true);
      expect(hasLeadingZeroBits(Buffer.from([0x00, 0xff]), 9)).toBe(false);
      expect(hasLeadingZeroBits(Buffer.from([0x01]), 7)).toBe(true);
      expect(hasLeadingZeroBits(Buffer.from([0x80]), 1)).toBe(false);
      expect(hasLeadingZeroBits(Buffer.alloc(32), 256)).toBe(true);
    });
  });
});
