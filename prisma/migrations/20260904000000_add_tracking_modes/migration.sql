CREATE TYPE "tracking_mode" AS ENUM ('tracked', 'declared');

ALTER TYPE "entry_source" ADD VALUE IF NOT EXISTS 'declared';
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'hours_proof';

ALTER TABLE "members"
ADD COLUMN "default_tracking_mode" "tracking_mode" NOT NULL DEFAULT 'tracked';

ALTER TABLE "project_assignments"
ADD COLUMN "tracking_mode" "tracking_mode";

CREATE TABLE "monthly_hour_declarations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_assignment_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "proof_document_id" UUID,
    "time_entry_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_member_id" UUID,
    "updated_by_member_id" UUID,
    "admin_modified_at" TIMESTAMPTZ(6),
    "admin_modified_by_member_id" UUID,
    "admin_modification_reason" TEXT,

    CONSTRAINT "monthly_hour_declarations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_hour_declarations_proof_document_id_key"
ON "monthly_hour_declarations"("proof_document_id");

CREATE UNIQUE INDEX "monthly_hour_declarations_time_entry_id_key"
ON "monthly_hour_declarations"("time_entry_id");

CREATE UNIQUE INDEX "monthly_hour_declarations_member_id_project_id_period_start_key"
ON "monthly_hour_declarations"("member_id", "project_id", "period_start");

CREATE INDEX "monthly_hour_declarations_member_id_period_start_idx"
ON "monthly_hour_declarations"("member_id", "period_start");

CREATE INDEX "monthly_hour_declarations_project_id_period_start_idx"
ON "monthly_hour_declarations"("project_id", "period_start");

CREATE INDEX "monthly_hour_declarations_assignment_period_idx"
ON "monthly_hour_declarations"("project_assignment_id", "period_start");

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_member_id_fkey"
FOREIGN KEY ("member_id") REFERENCES "members"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_project_assignment_id_fkey"
FOREIGN KEY ("project_assignment_id") REFERENCES "project_assignments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_proof_document_id_fkey"
FOREIGN KEY ("proof_document_id") REFERENCES "documents"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_time_entry_id_fkey"
FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "monthly_hour_declarations"
ADD CONSTRAINT "monthly_hour_declarations_admin_modified_by_member_id_fkey"
FOREIGN KEY ("admin_modified_by_member_id") REFERENCES "members"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
