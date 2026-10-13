CREATE TYPE "leave_type" AS ENUM ('vacation', 'sick');
CREATE TYPE "leave_day_part" AS ENUM ('full', 'morning', 'afternoon');

ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'sick_note';
-- No notification_rules row: a value added here cannot be used in the same transaction, and
-- getNotificationConfiguration() already treats a missing rule as email + in-app enabled.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'leave_month_end_reminder';

CREATE TABLE "leaves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "type" "leave_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "day_part" "leave_day_part" NOT NULL DEFAULT 'full',
    "note" TEXT,
    "attachment_document_id" UUID,
    "hr_processed_at" TIMESTAMPTZ(6),
    "hr_processed_by_member_id" UUID,
    "created_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_member_id" UUID,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leaves_date_order_check" CHECK ("end_date" >= "start_date"),
    CONSTRAINT "leaves_half_day_single_date_check" CHECK ("day_part" = 'full' OR "start_date" = "end_date")
);

CREATE TABLE "public_holidays" (
    "date" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "local_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "public_holiday_years" (
    "year" INTEGER NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "public_holiday_years_pkey" PRIMARY KEY ("year")
);

CREATE UNIQUE INDEX "leaves_attachment_document_id_key" ON "leaves"("attachment_document_id");
CREATE INDEX "leaves_member_id_start_date_idx" ON "leaves"("member_id", "start_date");
CREATE INDEX "leaves_start_date_end_date_idx" ON "leaves"("start_date", "end_date");
CREATE INDEX "leaves_hr_processed_at_idx" ON "leaves"("hr_processed_at");
CREATE INDEX "public_holidays_year_idx" ON "public_holidays"("year");

ALTER TABLE "leaves"
ADD CONSTRAINT "leaves_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "members"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leaves"
ADD CONSTRAINT "leaves_attachment_document_id_fkey"
FOREIGN KEY ("attachment_document_id") REFERENCES "documents"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leaves"
ADD CONSTRAINT "leaves_hr_processed_by_member_id_fkey"
FOREIGN KEY ("hr_processed_by_member_id") REFERENCES "members"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leaves"
ADD CONSTRAINT "leaves_created_by_member_id_fkey"
FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leaves"
ADD CONSTRAINT "leaves_deleted_by_member_id_fkey"
FOREIGN KEY ("deleted_by_member_id") REFERENCES "members"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
