ALTER TABLE "members"
ADD COLUMN "avatar_storage_bucket" TEXT,
ADD COLUMN "avatar_storage_key" TEXT,
ADD COLUMN "avatar_content_type" TEXT,
ADD COLUMN "avatar_byte_size" BIGINT,
ADD COLUMN "avatar_updated_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "members_avatar_storage_key_key" ON "members"("avatar_storage_key");
