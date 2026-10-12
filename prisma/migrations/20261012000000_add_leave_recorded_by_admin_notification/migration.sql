-- No notification_rules row: getNotificationConfiguration() already treats a missing rule as
-- email + in-app enabled.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'leave_recorded_by_admin';
