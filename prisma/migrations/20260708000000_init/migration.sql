-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "member_status" AS ENUM ('invited', 'active', 'inactive', 'deleted');

-- CreateEnum
CREATE TYPE "member_profile_type" AS ENUM ('employee', 'contractor');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "entry_source" AS ENUM ('grid', 'form', 'timer');

-- CreateEnum
CREATE TYPE "timesheet_status" AS ENUM ('submitted', 'rejected', 'approved', 'invoiced', 'invoice_rejected', 'accepted', 'paid');

-- CreateEnum
CREATE TYPE "timesheet_event_type" AS ENUM ('submitted', 'approved', 'rejected', 'unlocked', 'resubmitted', 'correction_opened', 'cancellation_invoice_uploaded', 'corrected_revision_submitted', 'invoice_uploaded', 'invoice_accepted', 'invoice_rejected', 'correction_closed', 'paid');

-- CreateEnum
CREATE TYPE "timesheet_correction_status" AS ENUM ('open', 'cancellation_required', 'correction_in_progress', 'corrected_invoice_required', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "rate_source" AS ENUM ('member_default', 'project_override');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('contractor_invoice', 'report_export', 'payslip');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('pending', 'available', 'failed', 'deleted');

-- CreateEnum
CREATE TYPE "invoice_role" AS ENUM ('original', 'replacement', 'cancellation', 'corrected');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('uploaded', 'accepted', 'rejected', 'replaced', 'cancelled', 'deleted');

-- CreateEnum
CREATE TYPE "report_mode" AS ENUM ('cost_free', 'internal');

-- CreateEnum
CREATE TYPE "report_view" AS ENUM ('user', 'project');

-- CreateEnum
CREATE TYPE "info_page_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('invite', 'password_reset', 'weekly_hours_reminder', 'monthly_invoice_reminder', 'timesheet_submitted', 'timesheet_approved', 'timesheet_rejected', 'invoice_uploaded', 'invoice_rejected', 'invoice_accepted', 'timesheet_paid');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('queued', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "payslip_status" AS ENUM ('available', 'missing', 'processing', 'failed');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_member_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3),
    "aaguid" TEXT,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "document_type" NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'pending',
    "owner_member_id" UUID,
    "storage_bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum_sha256" TEXT,
    "uploaded_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_member_id" UUID,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_id" UUID NOT NULL,
    "timesheet_revision_id" UUID NOT NULL,
    "correction_case_id" UUID,
    "document_id" UUID NOT NULL,
    "role" "invoice_role" NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'uploaded',
    "invoice_number" TEXT NOT NULL,
    "declared_amount" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "references_invoice_id" UUID,
    "uploaded_by_member_id" UUID NOT NULL,
    "reviewed_by_member_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_by_invoice_id" UUID,

    CONSTRAINT "contractor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" TEXT,
    "email" CITEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'member',
    "status" "member_status" NOT NULL DEFAULT 'invited',
    "current_profile" "member_profile_type" NOT NULL,
    "default_currency_code" CHAR(3) NOT NULL DEFAULT 'EUR',
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "inactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_profile_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "profile" "member_profile_type" NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_profile_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'member',
    "profile" "member_profile_type" NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'pending',
    "member_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "invited_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "info_page_status" NOT NULL DEFAULT 'draft',
    "published_version_id" UUID,
    "created_by_member_id" UUID NOT NULL,
    "updated_by_member_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "info_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_page_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "info_page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "info_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "weekly_hours_reminder" BOOLEAN NOT NULL DEFAULT true,
    "monthly_invoice_reminder" BOOLEAN NOT NULL DEFAULT true,
    "workflow_emails" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID,
    "email" CITEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "provider_message_id" TEXT,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_member_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "payslip_status" NOT NULL DEFAULT 'available',
    "document_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color_token" TEXT NOT NULL DEFAULT 'teal',
    "status" "project_status" NOT NULL DEFAULT 'active',
    "starts_on" DATE,
    "ends_on" DATE,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_member_id" UUID NOT NULL,
    "updated_by_member_id" UUID NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_projects" (
    "project_group_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_projects_pkey" PRIMARY KEY ("project_group_id","project_id")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_member_id" UUID,
    "updated_by_member_id" UUID,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_default_rate_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "hourly_rate" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_member_id" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "member_default_rate_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_rate_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_assignment_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "hourly_rate" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_member_id" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "assignment_rate_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "mode" "report_mode" NOT NULL,
    "view" "report_view" NOT NULL,
    "filters" JSONB NOT NULL,
    "timezone" TEXT NOT NULL,
    "render_snapshot" JSONB NOT NULL,
    "document_id" UUID,
    "generated_by_member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_assignment_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "source" "entry_source" NOT NULL,
    "locked_by_timesheet_revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by_member_id" UUID,
    "updated_by_member_id" UUID,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "running_timers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_assignment_id" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "running_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "draft_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_entry_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inactive_project_weeks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "week_start_date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inactive_project_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contractor_member_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "status" "timesheet_status" NOT NULL,
    "current_revision_id" UUID,
    "current_revision_number" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_member_id" UUID,
    "updated_by_member_id" UUID,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "status" "timesheet_status" NOT NULL,
    "correction_case_id" UUID,
    "created_from_revision_id" UUID,
    "superseded_by_revision_id" UUID,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "currency_code" CHAR(3) NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_member_id" UUID NOT NULL,

    CONSTRAINT "timesheet_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_locks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "timesheet_id" UUID NOT NULL,
    "timesheet_revision_id" UUID,
    "locked_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_by_member_id" UUID NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6),
    "unlocked_by_member_id" UUID,
    "unlock_reason" TEXT,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_snapshot_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_revision_id" UUID NOT NULL,
    "source_time_entry_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_assignment_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "rate_source" "rate_source" NOT NULL,
    "source_rate_period_id" UUID,
    "hourly_rate" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "line_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_snapshot_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_correction_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_id" UUID NOT NULL,
    "opened_from_revision_id" UUID NOT NULL,
    "corrected_revision_id" UUID,
    "cancellation_invoice_id" UUID,
    "status" "timesheet_correction_status" NOT NULL,
    "reason" TEXT NOT NULL,
    "opened_by_member_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_by_member_id" UUID,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "timesheet_correction_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timesheet_id" UUID NOT NULL,
    "timesheet_revision_id" UUID,
    "correction_case_id" UUID,
    "event_type" "timesheet_event_type" NOT NULL,
    "actor_member_id" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_member_id_created_at_idx" ON "audit_logs"("actor_member_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "passkey_userId_idx" ON "passkey"("userId");

-- CreateIndex
CREATE INDEX "passkey_credentialID_idx" ON "passkey"("credentialID");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_type_status_idx" ON "documents"("type", "status");

-- CreateIndex
CREATE INDEX "documents_owner_member_id_type_idx" ON "documents"("owner_member_id", "type");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_invoices_document_id_key" ON "contractor_invoices"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_invoices_replaced_by_invoice_id_key" ON "contractor_invoices"("replaced_by_invoice_id");

-- CreateIndex
CREATE INDEX "contractor_invoices_timesheet_id_status_idx" ON "contractor_invoices"("timesheet_id", "status");

-- CreateIndex
CREATE INDEX "contractor_invoices_timesheet_revision_id_role_status_idx" ON "contractor_invoices"("timesheet_revision_id", "role", "status");

-- CreateIndex
CREATE INDEX "contractor_invoices_correction_case_id_idx" ON "contractor_invoices"("correction_case_id");

-- CreateIndex
CREATE INDEX "contractor_invoices_invoice_number_idx" ON "contractor_invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "members_auth_user_id_key" ON "members"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "members_current_profile_idx" ON "members"("current_profile");

-- CreateIndex
CREATE INDEX "members_email_idx" ON "members"("email");

-- CreateIndex
CREATE INDEX "member_profile_periods_member_id_valid_from_idx" ON "member_profile_periods"("member_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "info_pages_slug_key" ON "info_pages"("slug");

-- CreateIndex
CREATE INDEX "info_pages_status_idx" ON "info_pages"("status");

-- CreateIndex
CREATE INDEX "info_page_versions_created_at_idx" ON "info_page_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "info_page_versions_info_page_id_version_key" ON "info_page_versions"("info_page_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_member_id_key" ON "notification_preferences"("member_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_member_id_created_at_idx" ON "notification_deliveries"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_type_created_at_idx" ON "notification_deliveries"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_idempotency_key_key" ON "job_runs"("idempotency_key");

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_document_id_key" ON "payslips"("document_id");

-- CreateIndex
CREATE INDEX "payslips_period_start_idx" ON "payslips"("period_start");

-- CreateIndex
CREATE INDEX "payslips_status_idx" ON "payslips"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_employee_member_id_period_start_key" ON "payslips"("employee_member_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_created_by_member_id_idx" ON "projects"("created_by_member_id");

-- CreateIndex
CREATE INDEX "projects_updated_by_member_id_idx" ON "projects"("updated_by_member_id");

-- CreateIndex
CREATE INDEX "projects_starts_on_ends_on_idx" ON "projects"("starts_on", "ends_on");

-- CreateIndex
CREATE UNIQUE INDEX "project_groups_slug_key" ON "project_groups"("slug");

-- CreateIndex
CREATE INDEX "project_group_projects_project_id_idx" ON "project_group_projects"("project_id");

-- CreateIndex
CREATE INDEX "project_assignments_member_id_active_idx" ON "project_assignments"("member_id", "active");

-- CreateIndex
CREATE INDEX "project_assignments_project_id_active_idx" ON "project_assignments"("project_id", "active");

-- CreateIndex
CREATE INDEX "project_assignments_member_id_project_id_idx" ON "project_assignments"("member_id", "project_id");

-- CreateIndex
CREATE INDEX "member_default_rate_periods_member_id_valid_from_idx" ON "member_default_rate_periods"("member_id", "valid_from");

-- CreateIndex
CREATE INDEX "assignment_rate_periods_project_assignment_id_valid_from_idx" ON "assignment_rate_periods"("project_assignment_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "report_exports_document_id_key" ON "report_exports"("document_id");

-- CreateIndex
CREATE INDEX "report_exports_generated_by_member_id_created_at_idx" ON "report_exports"("generated_by_member_id", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_mode_created_at_idx" ON "report_exports"("mode", "created_at");

-- CreateIndex
CREATE INDEX "time_entries_member_id_local_date_idx" ON "time_entries"("member_id", "local_date");

-- CreateIndex
CREATE INDEX "time_entries_project_id_local_date_idx" ON "time_entries"("project_id", "local_date");

-- CreateIndex
CREATE INDEX "time_entries_project_assignment_id_local_date_idx" ON "time_entries"("project_assignment_id", "local_date");

-- CreateIndex
CREATE INDEX "time_entries_locked_by_timesheet_revision_id_idx" ON "time_entries"("locked_by_timesheet_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "running_timers_member_id_key" ON "running_timers"("member_id");

-- CreateIndex
CREATE INDEX "running_timers_project_id_idx" ON "running_timers"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_entry_drafts_member_id_draft_key_key" ON "time_entry_drafts"("member_id", "draft_key");

-- CreateIndex
CREATE INDEX "inactive_project_weeks_week_start_date_idx" ON "inactive_project_weeks"("week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "inactive_project_weeks_member_id_project_id_week_start_date_key" ON "inactive_project_weeks"("member_id", "project_id", "week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_current_revision_id_key" ON "timesheets"("current_revision_id");

-- CreateIndex
CREATE INDEX "timesheets_status_period_start_idx" ON "timesheets"("status", "period_start");

-- CreateIndex
CREATE INDEX "timesheets_contractor_member_id_status_idx" ON "timesheets"("contractor_member_id", "status");

-- CreateIndex
CREATE INDEX "timesheets_period_start_period_end_idx" ON "timesheets"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_contractor_member_id_period_start_key" ON "timesheets"("contractor_member_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_revisions_superseded_by_revision_id_key" ON "timesheet_revisions"("superseded_by_revision_id");

-- CreateIndex
CREATE INDEX "timesheet_revisions_timesheet_id_revision_number_idx" ON "timesheet_revisions"("timesheet_id", "revision_number");

-- CreateIndex
CREATE INDEX "timesheet_revisions_status_submitted_at_idx" ON "timesheet_revisions"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "timesheet_revisions_correction_case_id_idx" ON "timesheet_revisions"("correction_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_revisions_timesheet_id_revision_number_key" ON "timesheet_revisions"("timesheet_id", "revision_number");

-- CreateIndex
CREATE INDEX "period_locks_timesheet_id_idx" ON "period_locks"("timesheet_id");

-- CreateIndex
CREATE INDEX "period_locks_timesheet_revision_id_idx" ON "period_locks"("timesheet_revision_id");

-- CreateIndex
CREATE INDEX "timesheet_snapshot_lines_timesheet_revision_id_idx" ON "timesheet_snapshot_lines"("timesheet_revision_id");

-- CreateIndex
CREATE INDEX "timesheet_snapshot_lines_project_id_local_date_idx" ON "timesheet_snapshot_lines"("project_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_snapshot_lines_timesheet_revision_id_source_time__key" ON "timesheet_snapshot_lines"("timesheet_revision_id", "source_time_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_correction_cases_corrected_revision_id_key" ON "timesheet_correction_cases"("corrected_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_correction_cases_cancellation_invoice_id_key" ON "timesheet_correction_cases"("cancellation_invoice_id");

-- CreateIndex
CREATE INDEX "timesheet_correction_cases_timesheet_id_status_idx" ON "timesheet_correction_cases"("timesheet_id", "status");

-- CreateIndex
CREATE INDEX "timesheet_correction_cases_opened_from_revision_id_idx" ON "timesheet_correction_cases"("opened_from_revision_id");

-- CreateIndex
CREATE INDEX "timesheet_events_timesheet_id_created_at_idx" ON "timesheet_events"("timesheet_id", "created_at");

-- CreateIndex
CREATE INDEX "timesheet_events_timesheet_revision_id_created_at_idx" ON "timesheet_events"("timesheet_revision_id", "created_at");

-- CreateIndex
CREATE INDEX "timesheet_events_correction_case_id_created_at_idx" ON "timesheet_events"("correction_case_id", "created_at");

-- CreateIndex
CREATE INDEX "timesheet_events_event_type_created_at_idx" ON "timesheet_events"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_member_id_fkey" FOREIGN KEY ("owner_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_correction_case_id_fkey" FOREIGN KEY ("correction_case_id") REFERENCES "timesheet_correction_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_references_invoice_id_fkey" FOREIGN KEY ("references_invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_replaced_by_invoice_id_fkey" FOREIGN KEY ("replaced_by_invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_timesheet_revision_id_fkey" FOREIGN KEY ("timesheet_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_invoices" ADD CONSTRAINT "contractor_invoices_uploaded_by_member_id_fkey" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_profile_periods" ADD CONSTRAINT "member_profile_periods_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_member_id_fkey" FOREIGN KEY ("invited_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_pages" ADD CONSTRAINT "info_pages_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_pages" ADD CONSTRAINT "info_pages_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "info_page_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_pages" ADD CONSTRAINT "info_pages_updated_by_member_id_fkey" FOREIGN KEY ("updated_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_page_versions" ADD CONSTRAINT "info_page_versions_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "info_page_versions" ADD CONSTRAINT "info_page_versions_info_page_id_fkey" FOREIGN KEY ("info_page_id") REFERENCES "info_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_member_id_fkey" FOREIGN KEY ("employee_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_member_id_fkey" FOREIGN KEY ("updated_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_projects" ADD CONSTRAINT "project_group_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_projects" ADD CONSTRAINT "project_group_projects_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "project_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_default_rate_periods" ADD CONSTRAINT "member_default_rate_periods_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_default_rate_periods" ADD CONSTRAINT "member_default_rate_periods_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_rate_periods" ADD CONSTRAINT "assignment_rate_periods_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_rate_periods" ADD CONSTRAINT "assignment_rate_periods_project_assignment_id_fkey" FOREIGN KEY ("project_assignment_id") REFERENCES "project_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_generated_by_member_id_fkey" FOREIGN KEY ("generated_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_locked_by_timesheet_revision_id_fkey" FOREIGN KEY ("locked_by_timesheet_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_assignment_id_fkey" FOREIGN KEY ("project_assignment_id") REFERENCES "project_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_timers" ADD CONSTRAINT "running_timers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_timers" ADD CONSTRAINT "running_timers_project_assignment_id_fkey" FOREIGN KEY ("project_assignment_id") REFERENCES "project_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_drafts" ADD CONSTRAINT "time_entry_drafts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inactive_project_weeks" ADD CONSTRAINT "inactive_project_weeks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inactive_project_weeks" ADD CONSTRAINT "inactive_project_weeks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_contractor_member_id_fkey" FOREIGN KEY ("contractor_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_revisions" ADD CONSTRAINT "timesheet_revisions_correction_case_id_fkey" FOREIGN KEY ("correction_case_id") REFERENCES "timesheet_correction_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_revisions" ADD CONSTRAINT "timesheet_revisions_created_from_revision_id_fkey" FOREIGN KEY ("created_from_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_revisions" ADD CONSTRAINT "timesheet_revisions_superseded_by_revision_id_fkey" FOREIGN KEY ("superseded_by_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_revisions" ADD CONSTRAINT "timesheet_revisions_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_timesheet_revision_id_fkey" FOREIGN KEY ("timesheet_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_snapshot_lines" ADD CONSTRAINT "timesheet_snapshot_lines_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_snapshot_lines" ADD CONSTRAINT "timesheet_snapshot_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_snapshot_lines" ADD CONSTRAINT "timesheet_snapshot_lines_project_assignment_id_fkey" FOREIGN KEY ("project_assignment_id") REFERENCES "project_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_snapshot_lines" ADD CONSTRAINT "timesheet_snapshot_lines_source_time_entry_id_fkey" FOREIGN KEY ("source_time_entry_id") REFERENCES "time_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_snapshot_lines" ADD CONSTRAINT "timesheet_snapshot_lines_timesheet_revision_id_fkey" FOREIGN KEY ("timesheet_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_correction_cases" ADD CONSTRAINT "timesheet_correction_cases_cancellation_invoice_id_fkey" FOREIGN KEY ("cancellation_invoice_id") REFERENCES "contractor_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_correction_cases" ADD CONSTRAINT "timesheet_correction_cases_corrected_revision_id_fkey" FOREIGN KEY ("corrected_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_correction_cases" ADD CONSTRAINT "timesheet_correction_cases_opened_from_revision_id_fkey" FOREIGN KEY ("opened_from_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_correction_cases" ADD CONSTRAINT "timesheet_correction_cases_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_correction_case_id_fkey" FOREIGN KEY ("correction_case_id") REFERENCES "timesheet_correction_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_timesheet_revision_id_fkey" FOREIGN KEY ("timesheet_revision_id") REFERENCES "timesheet_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
