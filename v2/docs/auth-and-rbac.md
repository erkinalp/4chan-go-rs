# Authentication, 2FA, RBAC, and Anti-Spam Tokens

Scope: `v2/api-core` (NestJS). GNAP (`v2/README-GNAP.md`) is the external
authorization layer; this document covers the service-local JWT + RBAC +
TOTP 2FA + anti-spam token machinery.

## Login and TOTP 2FA

```
POST /auth/login          -> password check
    user.twoFactorAuth = false -> { access_token, refresh_token, user }
    user.twoFactorAuth = true  -> { two_factor_required: true,
                                   challenge_token: <JWT, 5m, purpose=2fa-pending> }
POST /auth/2fa/challenge  -> { challenge_token, code }
    code = 6-digit TOTP, or a `xxxx-xxxx` backup code (single-use)
    on success -> { access_token, refresh_token, user }
```

- The challenge token is a JWT signed with `JWT_SECRET` carrying
  `purpose: "2fa-pending"` (TTL `JWT_2FA_CHALLENGE_EXPIRES_IN`, default 5m).
  `JwtStrategy.validate` rejects any token whose `purpose` claim is not
  `"access"`, so a challenge token can never be used as a session token.
- `lastLoginAt` is updated only after a fully authenticated session is
  issued (not after the password step alone).
- Access tokens also carry `user_id` and `created_at` claims — required by
  `UserRateLimiterInterceptor`, which reads them from the verified JWT.

### 2FA management endpoints (all require a valid access token)

| Endpoint | Purpose |
|---|---|
| `POST /auth/2fa/enable` | Mint a pending TOTP secret + otpauth URL |
| `POST /auth/2fa/verify` | Confirm a TOTP code, activate 2FA; returns backup codes **once** |
| `POST /auth/2fa/disable` | Password-confirmed disable; clears secret + backup codes and revokes all refresh tokens |
| `POST /auth/2fa/backup-codes` | Password-confirmed regeneration of backup codes |

Backup codes: 8 codes, `xxxx-xxxx` format; only SHA-256 hashes are stored
(`User.twoFactorBackupCodes`), and each is consumed on use.

## RBAC audit

Roles: `USER < JANITOR < MODERATOR < ADMIN` (Prisma `Role` enum).
Guards compose as `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`.

| Route | State-changing | Guard |
|---|---|---|
| `POST /boards`, `PATCH /boards/:id`, `DELETE /boards/:id`, `POST /boards/categories` | yes | `ADMIN` |
| `PATCH /threads/:id`, `/lock`, `/unlock`, `/sticky`, `/archive`, `DELETE /threads/:id` | yes | `MODERATOR`, `ADMIN` |
| `POST /boards/:boardId/threads` | yes | public by design (anonymous imageboard posting) |
| `DELETE /posts/:id` | yes | `JANITOR`, `MODERATOR`, `ADMIN` |
| `POST /threads/:threadId/posts` | yes | public by design |
| `POST /moderation/reports`, `POST /moderation/bans/:id/appeal` | yes | public by design (anonymous reporting/appeals) |
| `GET /moderation/reports`, `PUT /reports/:id/resolve`, `GET /wordfilters` | no/yes | `JANITOR`+ |
| `POST /moderation/bans`, `GET /bans`, `PUT /bans/:id/revoke`, `PUT /bans/:id/appeal`, `GET /bans/check/:ipHash`, `POST|DELETE /wordfilters` | mixed | `MODERATOR`, `ADMIN` |
| `GET /moderation/audit` | no | `ADMIN` |
| `POST /files/upload` | yes | public by design (anonymous posting needs anonymous upload) |
| `POST /files/metadata` | yes | **`ADMIN`** — was any-authenticated-user; fixed in this change |
| `DELETE /files/:id` | yes | `MODERATOR`, `ADMIN` |
| `POST /auth/*` (logout, me, 2fa/*) | yes | `JwtAuthGuard` |
| `GET` listing/read endpoints, `GET /health*` | no | public |

The public-by-design write endpoints are the imageboard's core model
(anonymous posting/reporting). Their abuse control is rate limiting +
captcha/PoW tokens (below), not roles.

## Anti-spam: Privacy-Pass-style PoW tokens

Choice: SHA-256 partial-inversion proof-of-work (classic Cloudflare
Privacy Pass style), **not** RFC 9578 Private Tokens. Rationale: the same
service issues and redeems tokens, so blind-signature issuer/attester/origin
separation buys nothing; PoW additionally taxes issuance itself. See
`captcha/pow-token.service.ts`.

```
GET  /captcha/pow/challenge -> { challenge_id, challenge, algorithm: sha256,
                                difficulty_bits, expires_in }
     client finds nonce s.t. sha256(`${challenge}:${nonce}`) has >=
     difficulty_bits leading zero bits
POST /captcha/pow/redeem    -> { challenge_id, nonce } -> { token, expires_in }
POST /captcha/pow/verify    -> { token } -> { valid } (consumes the token)
```

Replay protection: challenges and tokens are single-use — both are consumed
atomically via Redis `GETDEL`. Config: `POW_DIFFICULTY_BITS` (default 18),
`POW_CHALLENGE_TTL_SECONDS` (300), `POW_TOKEN_TTL_SECONDS` (600).
`PowTokenService.verifyPowToken(token)` is exported for other modules that
want to require a token on an action.

## Config additions

| Env var | Default | Purpose |
|---|---|---|
| `JWT_2FA_CHALLENGE_EXPIRES_IN` | `5m` | TTL of the pending-2FA challenge token |
| `POW_DIFFICULTY_BITS` | `18` | Required leading zero bits in `sha256(challenge:nonce)` |
| `POW_CHALLENGE_TTL_SECONDS` | `300` | PoW challenge TTL |
| `POW_TOKEN_TTL_SECONDS` | `600` | Issued PoW token TTL |

## Schema migration

`User.twoFactorBackupCodes String[]` was added to
`v2/api-core/prisma/schema.prisma`. Deploy by running `prisma migrate dev` /
`db push` — the change is additive and backwards-compatible.
