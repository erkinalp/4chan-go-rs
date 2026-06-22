# API Reference

Base URL: `/api/v1`

All endpoints return JSON. Protected endpoints require `Authorization: Bearer <jwt>` header.

## Authentication

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "username": "newuser",
  "password": "SecurePass123!",
  "email": "user@example.com"
}
```

**Response (201):**
```json
{
  "userId": "uuid-string",
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Errors:** `400` invalid input, `409` username/email taken

---

### POST /auth/login
Authenticate and receive tokens.

**Request:**
```json
{
  "username": "existinguser",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "userId": "uuid-string",
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Errors:** `401` invalid credentials, `429` rate limited

---

### POST /auth/refresh
Exchange a refresh token for a new access token.

**Request:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200):**
```json
{
  "token": "new-jwt-access-token"
}
```

**Errors:** `401` invalid/expired refresh token

---

### POST /auth/logout
Invalidate the current session. **Auth required.**

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /auth/me
Get current user profile. **Auth required.**

**Response (200):**
```json
{
  "id": "uuid-string",
  "username": "currentuser",
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## Boards

### GET /boards
List all boards.

**Query params:** `?search=<term>` (optional)

**Response (200):**
```json
{
  "boards": [
    {
      "id": "uuid-string",
      "slug": "tech",
      "title": "Technology",
      "description": "Technology discussion",
      "nsfw": false,
      "threadCount": 150,
      "postCount": 4200
    }
  ]
}
```

---

### GET /boards/:id
Get board details.

**Response (200):**
```json
{
  "id": "uuid-string",
  "slug": "tech",
  "title": "Technology",
  "description": "Technology discussion",
  "nsfw": false,
  "maxFilesize": 4194304,
  "bumpLimit": 300,
  "imageLimit": 150,
  "threadCount": 150,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Errors:** `404` board not found

---

### POST /boards
Create a new board. **Auth required (admin).**

**Request:**
```json
{
  "slug": "tech",
  "title": "Technology",
  "description": "Technology discussion",
  "nsfw": false
}
```

**Response (201):** Board object (same as GET)

---

## Threads

### GET /boards/:boardId/threads
List threads in a board, ordered by last bump time.

**Query params:** `?page=1&limit=15`

**Response (200):**
```json
{
  "threads": [
    {
      "id": "uuid-string",
      "subject": "Thread subject",
      "message": "Opening post content...",
      "authorName": "Anonymous",
      "replyCount": 42,
      "imageCount": 12,
      "sticky": false,
      "closed": false,
      "lastBumpedAt": "2024-06-15T10:30:00Z",
      "createdAt": "2024-06-14T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 15,
    "total": 150
  }
}
```

---

### GET /threads/:id
Get thread with all posts.

**Response (200):**
```json
{
  "id": "uuid-string",
  "boardId": "uuid-string",
  "subject": "Thread subject",
  "sticky": false,
  "closed": false,
  "posts": [
    {
      "id": "uuid-string",
      "message": "Post content",
      "authorName": "Anonymous",
      "tripcode": "",
      "file": {
        "id": "uuid-string",
        "filename": "image.png",
        "thumbnailUrl": "https://cdn.example.com/thumbs/abc.jpg",
        "url": "https://cdn.example.com/uploads/abc.png",
        "size": 245000,
        "width": 1920,
        "height": 1080
      },
      "createdAt": "2024-06-14T08:00:00Z"
    }
  ]
}
```

**Errors:** `404` thread not found

---

### POST /boards/:boardId/threads
Create a new thread. **Auth required.** Supports multipart/form-data for file upload.

**Request (multipart):**
- `subject` (string) — Thread subject
- `message` (string, required) — Opening post content
- `file` (file, optional) — Attached image

**Response (201):** Thread object

**Errors:** `400` validation error, `403` banned, `429` rate limited

---

## Posts

### POST /threads/:threadId/posts
Create a reply in a thread. **Auth required.** Supports multipart/form-data.

**Request:**
```json
{
  "message": "Reply content"
}
```

**Response (201):**
```json
{
  "id": "uuid-string",
  "threadId": "uuid-string",
  "message": "Reply content",
  "authorName": "Anonymous",
  "createdAt": "2024-06-15T12:00:00Z"
}
```

**Errors:** `400` validation, `403` banned/thread closed, `404` thread not found, `429` rate limited

---

### GET /posts/:id
Get a single post by ID.

**Response (200):** Post object

---

## Files

### POST /files/upload
Upload a file. **Auth required.** Multipart/form-data.

**Request:**
- `file` (file, required) — The file to upload

**Response (201):**
```json
{
  "id": "uuid-string",
  "filename": "original-name.png",
  "mimeType": "image/png",
  "size": 245000,
  "width": 1920,
  "height": 1080,
  "md5": "base64-hash",
  "sha256": "hex-hash",
  "thumbnailUrl": "https://cdn.example.com/thumbs/abc.jpg",
  "uploadedAt": "2024-06-15T12:00:00Z"
}
```

**Errors:** `400` invalid file, `413` file too large, `415` unsupported type, `429` rate limited

---

### GET /files/:id
Get file metadata.

**Response (200):** File object (same as upload response)

---

### GET /files/:id/download
Download the original file. Returns the file binary with appropriate Content-Type header.

---

## Moderation

### POST /reports
Report a post. **Auth required.**

**Request:**
```json
{
  "postId": "uuid-string",
  "threadId": "uuid-string",
  "reason": "spam",
  "description": "This post is advertising spam."
}
```

**Response (201):**
```json
{
  "id": "uuid-string",
  "postId": "uuid-string",
  "reason": "spam",
  "status": "pending",
  "createdAt": "2024-06-15T12:00:00Z"
}
```

---

### GET /mod/reports
List pending reports. **Auth required (moderator+).**

**Query params:** `?status=pending&page=1&limit=20`

**Response (200):**
```json
{
  "reports": [
    {
      "id": "uuid-string",
      "postId": "uuid-string",
      "threadId": "uuid-string",
      "reason": "spam",
      "description": "Spam content",
      "status": "pending",
      "createdAt": "2024-06-15T12:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

### POST /mod/bans
Ban a user. **Auth required (moderator+).**

**Request:**
```json
{
  "userId": "uuid-string",
  "reason": "Repeated spam violations",
  "duration": 86400,
  "boardId": "uuid-string"
}
```

**Response (201):**
```json
{
  "id": "uuid-string",
  "userId": "uuid-string",
  "reason": "Repeated spam violations",
  "duration": 86400,
  "boardId": "uuid-string",
  "createdAt": "2024-06-15T12:00:00Z",
  "expiresAt": "2024-06-16T12:00:00Z"
}
```

---

### DELETE /mod/bans/:userId
Unban a user. **Auth required (moderator+).**

**Request body:** `{ "boardId": "uuid-string" }` (optional, for board-specific unban)

**Response (200):**
```json
{
  "message": "User unbanned successfully"
}
```

---

### GET /mod/log
Get moderation action log. **Auth required (moderator+).**

**Response (200):**
```json
{
  "actions": [
    {
      "id": "uuid-string",
      "moderatorId": "uuid-string",
      "action": "ban",
      "targetUserId": "uuid-string",
      "reason": "Spam",
      "createdAt": "2024-06-15T12:00:00Z"
    }
  ]
}
```

---

## Health

### GET /health
System health check. No authentication required.

**Response (200):**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "s3": "healthy"
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    { "field": "username", "message": "Must be 3-32 characters" }
  ]
}
```

## Rate Limiting

Rate limits are applied per-IP and per-user. Headers included in responses:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Window reset time (Unix) |
| `Retry-After` | Seconds until retry (on 429) |

Default limits:
- Anonymous: 60 req/min
- Authenticated: 120 req/min
- File uploads: 10/min
- Registration: 3/hour per IP
