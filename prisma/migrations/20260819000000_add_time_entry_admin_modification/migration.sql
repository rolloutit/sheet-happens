ALTER TABLE "time_entries"
ADD COLUMN "admin_modified_at" TIMESTAMPTZ(6),
ADD COLUMN "admin_modified_by_member_id" UUID,
ADD COLUMN "admin_modification_reason" TEXT;

CREATE INDEX "time_entries_admin_modified_by_member_id_admin_modified_at_idx"
ON "time_entries"("admin_modified_by_member_id", "admin_modified_at");

ALTER TABLE "time_entries"
ADD CONSTRAINT "time_entries_admin_modified_by_member_id_fkey"
FOREIGN KEY ("admin_modified_by_member_id") REFERENCES "members"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
