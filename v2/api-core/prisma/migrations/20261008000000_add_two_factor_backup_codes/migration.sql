-- The repository has no baseline migrations (schema is managed with
-- `prisma db push`), so guard on the table existing: on a fresh database
-- this is a no-op and `db push` creates the column; on a deployment that
-- predates the field it backfills it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'User'
    ) THEN
        ALTER TABLE "User"
            ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
    END IF;
END $$;
