CREATE TYPE "duration_display_format" AS ENUM ('decimal_hours', 'hours_minutes');

ALTER TABLE "members"
ADD COLUMN "duration_display_format" "duration_display_format" NOT NULL DEFAULT 'decimal_hours';
