CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

CREATE TABLE "password_sign_in_lockouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_hash" TEXT NOT NULL,
    "member_id" UUID,
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "failure_window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_sign_in_lockouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_sign_in_lockouts_subject_hash_key"
  ON "password_sign_in_lockouts"("subject_hash");
CREATE INDEX "password_sign_in_lockouts_member_id_idx"
  ON "password_sign_in_lockouts"("member_id");
CREATE INDEX "password_sign_in_lockouts_locked_until_idx"
  ON "password_sign_in_lockouts"("locked_until");
