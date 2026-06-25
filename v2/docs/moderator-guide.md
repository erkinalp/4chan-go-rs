# Moderator Guide

This guide covers how to use the v2 moderation tools for managing reports, bans, and board administration.

## Roles and Permissions

| Role | Capabilities |
|---|---|
| **User** | Submit reports |
| **Janitor** | View reports, delete posts |
| **Moderator** | All janitor powers + ban users, manage threads |
| **Admin** | All moderator powers + manage boards, manage roles |

## Reviewing Reports

### Accessing the Report Queue

**API:** `GET /api/v1/mod/reports?status=pending`

Reports include:
- The reported post content and metadata
- Reporter's reason and description
- Board and thread context
- Timestamp

### Report Reasons

| Reason | Description |
|---|---|
| `spam` | Commercial spam or repeated advertising |
| `illegal` | Content that violates laws |
| `harassment` | Targeted harassment of individuals |
| `off_topic` | Content unrelated to the board topic |
| `nsfw` | NSFW content on a SFW board |
| `other` | Other rule violations |

### Resolving Reports

After reviewing a report, take one of these actions:

1. **Dismiss** — Report was invalid, no action needed
2. **Delete post** — Remove the offending content
3. **Ban user** — Apply a ban if the violation warrants it
4. **Delete + Ban** — Remove content and ban the user

All actions are logged in the moderation log.

## Managing Bans

### Issuing a Ban

**API:** `POST /api/v1/mod/bans`

```json
{
  "userId": "target-user-id",
  "reason": "Clear description of violation",
  "duration": 86400,
  "boardId": "board-id-or-null-for-global"
}
```

**Duration guidelines:**

| Offense | Suggested Duration |
|---|---|
| First minor offense (off-topic) | 1 hour (3600s) |
| Repeated minor offenses | 24 hours (86400s) |
| NSFW on SFW board | 3 days (259200s) |
| Spam | 7 days (604800s) |
| Harassment | 30 days (2592000s) |
| Illegal content | Permanent (0 = permanent) |

### Ban Scope

- **Board ban**: User is banned from posting on a specific board only
- **Global ban**: User is banned from all boards (omit `boardId` or set to `null`)

### Viewing Active Bans

**API:** `GET /api/v1/mod/bans?active=true`

### Lifting a Ban

**API:** `DELETE /api/v1/mod/bans/:userId`

Always document why a ban is being lifted in the moderation log.

## Thread Management

### Sticky a Thread

Pin important threads to the top of the board listing.

**API:** `PATCH /api/v1/threads/:id`
```json
{ "sticky": true }
```

### Lock a Thread

Prevent new replies while keeping the thread visible.

**API:** `PATCH /api/v1/threads/:id`
```json
{ "closed": true }
```

### Archive a Thread

Move a thread to the archive (read-only, eventually purged).

**API:** `PATCH /api/v1/threads/:id`
```json
{ "archived": true }
```

### Delete a Thread

Remove a thread and all its posts entirely.

**API:** `DELETE /api/v1/threads/:id`

This is irreversible. Use only for content that clearly violates rules.

## Board Management (Admin only)

### Create a Board

**API:** `POST /api/v1/boards`
```json
{
  "slug": "tech",
  "title": "Technology",
  "description": "Discussion of technology topics",
  "nsfw": false
}
```

### Update Board Configuration

**API:** `PATCH /api/v1/boards/:id`
```json
{
  "description": "Updated description",
  "bumpLimit": 500,
  "imageLimit": 200
}
```

## Moderation Log

All moderation actions are recorded in an immutable audit log.

**API:** `GET /api/v1/mod/log?page=1&limit=50`

Each log entry contains:
- Action type (ban, unban, delete, sticky, lock, etc.)
- Moderator who performed it
- Target user/post/thread
- Reason
- Timestamp

The log cannot be edited or deleted. It serves as an accountability record.

## Best Practices

1. **Be consistent** — Apply rules uniformly across all users
2. **Document reasons** — Always provide clear ban reasons
3. **Escalate when unsure** — If a situation is ambiguous, ask a senior moderator
4. **Prefer warnings for first offenses** — Unless the violation is severe
5. **Check context** — Read the full thread before acting on a single post report
6. **Don't engage** — Handle violations through official tools, not personal replies
7. **Protect privacy** — Never expose user IP addresses or personal information
8. **Review the log** — Periodically check the moderation log for consistency

## Emergency Procedures

### Raid/Spam Attack

1. Enable heightened rate limiting via admin panel
2. Temporarily increase CAPTCHA difficulty
3. Issue broad bans on identified attack patterns
4. Report to admin team for infrastructure-level mitigation

### Illegal Content

1. Delete immediately without reviewing further
2. Issue permanent global ban
3. Preserve evidence hash for authorities if required
4. Report to admin team
5. Do not discuss the content with other users
