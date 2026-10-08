# Testing file-service

## Unit tests

```sh
go test ./...
```

Redis-dependent tests are backed by [miniredis](https://github.com/alicebob/miniredis)
and run fully in-process — no external services needed.

### Repository tests (real Postgres)

`internal/repository` tests run against a real PostgreSQL instance because the
repository API accepts the concrete `*pgxpool.Pool` type (sqlmock-style
stand-ins do not satisfy it). They are opt-in via an environment variable and
skip silently when it is unset:

```sh
# Stand up a throwaway database (any reachable Postgres works)
docker run -d --name fs-test-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=file_service_test \
  -p 5432:5432 postgres:16-alpine

export FILE_SERVICE_TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/file_service_test?sslmode=disable"
go test ./internal/repository/... -v
```

The tests create their own tables (`files`, `banned_files`,
`file_processing_queue`) inside a transaction-safe setup and truncate between
runs — they do not run the app migrations and do not touch other tables.

## Coverage

```sh
# Per-package summary
go test ./... -cover

# Per-function profile written to coverage.out + rendered HTML
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out      # per-function table
go tool cover -html=coverage.out      # open in browser
```

Pure unit tests and repository tests can be combined in one profile; set
`FILE_SERVICE_TEST_DATABASE_URL` first if you want repository coverage included.
