import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";

// Privacy-Pass-style proof-of-work tokens.
//
// Choice: this is a SHA-256 partial-inversion PoW scheme (as used by the
// original Cloudflare Privacy Pass / Anubis-style solvers) rather than an
// RFC 9578 Private Token. Private Tokens need a blind-RSA/BLS key ceremony
// and a separate issuer↔attester↔origin trust split; here the same service
// issues and redeems tokens, so the extra crypto buys nothing. A PoW also
// doubles as a rate-limiter: issuance itself costs the client CPU, which
// plain signature tokens do not provide.
//
// Flow:
//   1. GET  /captcha/pow/challenge -> server-minted random challenge
//   2. client finds `nonce` such that
//      sha256(`${challenge}:${nonce}`) has >= difficulty leading zero bits
//   3. POST /captcha/pow/redeem -> verifies the PoW, atomically consumes the
//      challenge (single-use) and returns a bearer token
//   4. POST /captcha/pow/verify (or CaptchaService consumers) -> atomically
//      consumes the token; a second use fails (replay protection)
//
// All state lives in Redis with TTLs; both the challenge and the token are
// consumed via GETDEL so redemption/verification are exactly-once.

@Injectable()
export class PowTokenService {
  private readonly logger = new Logger(PowTokenService.name);
  private redis: Redis;
  private readonly difficultyBits: number;
  private readonly challengeTtlSeconds: number;
  private readonly tokenTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get("REDIS_HOST", "redis"),
      port: this.config.get("REDIS_PORT", 6379),
      password: this.config.get("REDIS_PASSWORD"),
      db: this.config.get("REDIS_DB", 0),
    });
    // Prevent ioredis 'error' events from crashing the process unhandled.
    this.redis.on("error", (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
    // ~2^18 hashes ≈ a few seconds of work in JS/WASM; tune via env.
    this.difficultyBits = Number(this.config.get("POW_DIFFICULTY_BITS") ?? 18);
    this.challengeTtlSeconds = Number(
      this.config.get("POW_CHALLENGE_TTL_SECONDS") ?? 300,
    );
    this.tokenTtlSeconds = Number(
      this.config.get("POW_TOKEN_TTL_SECONDS") ?? 600,
    );
  }

  async issueChallenge() {
    const id = randomBytes(16).toString("hex");
    const challenge = randomBytes(16).toString("hex");
    await this.redis.setex(
      `pow:challenge:${id}`,
      this.challengeTtlSeconds,
      challenge,
    );
    return {
      challenge_id: id,
      challenge,
      algorithm: "sha256",
      difficulty_bits: this.difficultyBits,
      expires_in: this.challengeTtlSeconds,
    };
  }

  async redeemChallenge(challengeId: string, nonce: string) {
    const challenge = await this.redis.getdel(`pow:challenge:${challengeId}`);
    if (!challenge) {
      throw new BadRequestException("Invalid or expired challenge");
    }

    const digest = createHash("sha256")
      .update(`${challenge}:${nonce}`)
      .digest();
    if (!hasLeadingZeroBits(digest, this.difficultyBits)) {
      throw new BadRequestException("Insufficient proof of work");
    }

    const token = randomBytes(24).toString("base64url");
    await this.redis.setex(`pow:token:${token}`, this.tokenTtlSeconds, "1");
    return { token, expires_in: this.tokenTtlSeconds };
  }

  // Consumes the token exactly once (GETDEL); a replayed token returns false.
  async verifyPowToken(token: string): Promise<boolean> {
    if (!token) return false;
    return (await this.redis.getdel(`pow:token:${token}`)) !== null;
  }

  // Non-consuming check for callers that only introspect.
  async peekPowToken(token: string): Promise<boolean> {
    if (!token) return false;
    return (await this.redis.get(`pow:token:${token}`)) !== null;
  }
}

export function hasLeadingZeroBits(digest: Buffer, bits: number): boolean {
  for (let i = 0; i < bits; i++) {
    const byte = digest[i >> 3];
    if (byte === undefined || (byte & (0x80 >> (i & 7))) !== 0) {
      return false;
    }
  }
  return true;
}
