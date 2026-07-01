# Auth And User Management

Date: 2026-07-02

## Purpose

This document defines the v1 authentication and user-management workflow before building admin
screens and domain services. Better Auth owns authentication records; Sheet Happens owns member
profiles, invitations, authorization, audit, and business lifecycle.

## v1 Auth Methods

V1 supports:

- Magic links for first-time invite acceptance and passwordless sign-in.
- Passkeys for phishing-resistant passwordless sign-in.
- Two-factor authentication using TOTP and backup codes.

Email/password is not a primary v1 sign-in method. If it is enabled later, it must still respect
invite-only account creation and 2FA.

## Ownership Boundary

Better Auth owns:

- `user`, `session`, `account`, `verification`.
- `passkey`.
- `twoFactor`.
- Auth cookies, sessions, passkey challenges, magic-link tokens, TOTP secrets, and backup codes.

Sheet Happens owns:

- `members`.
- `member_profile_periods`.
- `invitations`.
- Role/profile authorization.
- User lifecycle status: invited, active, inactive, deleted.
- Audit logs and workflow events.

`members.auth_user_id` links one domain member to one Better Auth user.

## Invite-Only Rule

Public self-signup is not allowed.

Magic-link requests must only send mail when the normalized email belongs to:

- A pending, non-expired invitation.
- An existing active member.
- An existing invited member that is completing activation.

For unknown emails, the API should still return a neutral success response to avoid account
enumeration, but no email is sent.

## Invitation Flow

1. Admin creates invitation with email, name, role, and profile type.
2. System creates or reserves a `members` row with status `invited`.
3. System creates `member_profile_periods` row beginning on activation date or first valid work date,
   depending on admin input.
4. System sends invite email with a magic-link sign-in route.
5. User opens link.
6. Better Auth verifies the magic-link token and creates the auth `user` if needed.
7. Domain activation links `members.auth_user_id`, marks member `active`, and writes audit log.
8. User is taken through first-run security setup:
   - Register a passkey.
   - Enable TOTP 2FA.
   - Store backup codes.

Passkey and 2FA setup can be strongly encouraged during onboarding. Admins should be required to
enable 2FA before using back-office management features.

## Sign-In Flow

Supported sign-in paths:

- Magic link.
- Passkey.

After Better Auth returns a session, every protected page/action must load the linked `members` row
and enforce domain status:

- `invited`: allow only onboarding and activation completion.
- `active`: allow authorized app access.
- `inactive`: block app access and show a locked state.
- `deleted`: block access; retain records for audit/legal requirements.

## 2FA Rules

- TOTP is the v1 second factor.
- Backup codes are generated and stored by Better Auth.
- Passwordless users must be able to enable/manage 2FA, so Better Auth 2FA uses passwordless mode.
- Trusted devices may be allowed for ordinary members.
- Admins should not rely only on trusted-device bypass for sensitive management actions; sensitive
  admin actions can later require recent 2FA verification.

## Passkey Rules

- Passkey sign-in is supported for all active users.
- Passkey registration normally requires an authenticated session.
- Invite acceptance uses magic link first, then passkey enrollment during onboarding.
- Passkey-first onboarding is not required for v1.
- Users can list, rename, and delete their own passkeys.
- Admins can revoke sessions and disable a user, but should not directly inspect passkey material.

## User Management Actions

Admin actions:

- Invite member.
- Resend invitation.
- Edit name, locale, timezone, role, and profile type.
- Transition employee/contractor profile with effective dates.
- Inactivate/reactivate member.
- Soft-delete member.
- Revoke sessions.

Member actions:

- View own profile.
- Manage passkeys.
- Enable/disable TOTP.
- Regenerate backup codes.
- Update notification preferences.

## Authorization Helpers

Server-side helpers should exist before feature work:

- `getSession`.
- `requireSession`.
- `getCurrentMember`.
- `requireMember`.
- `requireAdmin`.
- `requireProfile`.
- `requireActiveMember`.

Client-side visibility is only convenience. Server actions, route handlers, document signed URLs, and
report exports must call server-side authorization helpers.

## Audit Requirements

Audit at minimum:

- Invitation created/resend/revoked/accepted.
- Member activated/inactivated/reactivated/deleted.
- Role change.
- Profile transition.
- Session revocation.
- 2FA enabled/disabled.
- Passkey added/deleted.

Auth secrets, TOTP secrets, passkey public keys, backup codes, and magic-link tokens must not be
stored in domain audit details.

## Implementation Order

1. Better Auth server/client config and Next route handler.
2. Better Auth plugin schema for magic links, passkeys, and 2FA.
3. Server-side auth guards.
4. Invitation service.
5. Activation completion service.
6. Admin user-management server actions.
7. Onboarding/security setup UI.
8. Admin user-management UI.
9. Tests for invite-only auth, inactive user blocking, admin guard, profile guard, passkey setup, and
   2FA setup.
