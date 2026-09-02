ALTER TABLE "payslips"
  ADD COLUMN "published_by_member_id" UUID;

CREATE INDEX "payslips_published_by_member_id_idx"
  ON "payslips"("published_by_member_id");

ALTER TABLE "payslips"
  ADD CONSTRAINT "payslips_published_by_member_id_fkey"
  FOREIGN KEY ("published_by_member_id") REFERENCES "members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
