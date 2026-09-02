ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'payslip_available';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'time_entry_admin_modified';

CREATE TABLE "notification_configuration" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'system',
    "company_timezone" TEXT NOT NULL DEFAULT 'Europe/Budapest',
    "weekly_weekday" INTEGER NOT NULL DEFAULT 5,
    "weekly_time" VARCHAR(5) NOT NULL DEFAULT '16:00',
    "invoice_initial_delay_hours" INTEGER NOT NULL DEFAULT 72,
    "invoice_repeat_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "updated_by_member_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_configuration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_rules" (
    "type" "notification_type" NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_member_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("type")
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "action_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notification_deliveries"
    ADD COLUMN "idempotency_key" TEXT,
    ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "last_attempt_at" TIMESTAMPTZ(6);

UPDATE "notification_deliveries"
SET "idempotency_key" = 'legacy:' || "id"::text
WHERE "idempotency_key" IS NULL;

ALTER TABLE "notification_deliveries"
    ALTER COLUMN "idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");
CREATE INDEX "notifications_member_id_read_at_created_at_idx" ON "notifications"("member_id", "read_at", "created_at");
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

ALTER TABLE "notification_configuration" ADD CONSTRAINT "notification_configuration_updated_by_member_id_fkey"
    FOREIGN KEY ("updated_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_updated_by_member_id_fkey"
    FOREIGN KEY ("updated_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "notification_configuration" ("id", "updated_at")
VALUES ('system', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "notification_rules" ("type", "email_enabled", "in_app_enabled", "updated_at") VALUES
    ('weekly_hours_reminder', true, true, CURRENT_TIMESTAMP),
    ('monthly_invoice_reminder', true, true, CURRENT_TIMESTAMP),
    ('timesheet_submitted', true, true, CURRENT_TIMESTAMP),
    ('timesheet_approved', true, true, CURRENT_TIMESTAMP),
    ('timesheet_rejected', true, true, CURRENT_TIMESTAMP),
    ('invoice_uploaded', true, true, CURRENT_TIMESTAMP),
    ('invoice_rejected', true, true, CURRENT_TIMESTAMP),
    ('invoice_accepted', true, true, CURRENT_TIMESTAMP),
    ('timesheet_paid', true, true, CURRENT_TIMESTAMP),
    ('payslip_available', true, true, CURRENT_TIMESTAMP),
    ('time_entry_admin_modified', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("type") DO NOTHING;
