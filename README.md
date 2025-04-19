![4chan-1-2021-800-3992876958](https://github.com/user-attachments/assets/b05f4584-04e0-47fd-baf4-6269d0024bf4)


This is the original source code powering 4chan, an anonymous imageboard launched in 2003. The codebase was designed to be lightweight, fast, and easy to deploy on minimal hosting resources. It draws heavy inspiration from Japanese imageboards such as Futaba Channel (2chan), and was initially written in PHP with a MySQL backend.

We must learn to **unlearn**: it's not a contradiction, but an act of internal repair. In a world that advances as quickly as ours, many teachings become obsolete and limit us. Only by letting go of what we've learned can we open ourselves to authentic growth.

We need **new ideas** that are born from our deep feelings. When customs have become rigid codes and routines seem like pre-written scripts, only genuine creativity can free us from the confinement of repetition.

I wasn't an active 4chan user, but I recognize that freedom of expression—and the spaces that foster it—are essential. Each mind harbors a spark of wisdom: I didn't inaugurate this forum to bear the responsibility of what happens there, but to offer a place where each person can find their own answer.

—Verso Terso

## Modernization Project

The `v2/` directory contains the complete modernization with microservices architecture and micro-frontends.

### Main Folders in v2/

- **api-specs**: OpenAPI specifications
- **api-core**: API Core (TypeScript/NestJS)
- **file-service**: File management service (Go)
- **media-processor**: Media processor (Rust)
- **frontend-legacy**: Traditional React frontend
- **frontend-modern**: Advanced React frontend
- **microfrontends**: Micro-frontends implementation
- **docs**: Technical documentation
- **infrastructure**: Infrastructure configuration

## Security

**IMPORTANT**: Before starting development:

1. **Never** use default values in `.env.example` files in production
2. **Always** change all passwords, secrets, and API keys
3. All sensitive values are marked with `[REDACTED]` and must be replaced
