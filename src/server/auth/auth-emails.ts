import { mailer } from "@/src/server/email/mailer";
import { INVITATION_VALIDITY_HOURS } from "@/src/server/users/invitation-expiry";

export type MagicLinkEmailInput = {
  email: string;
  url: string;
};

export type InvitationEmailInput = {
  email: string;
  name: string;
  acceptUrl: string;
};

export type PasswordResetEmailInput = {
  email: string;
  url: string;
};

export async function sendMagicLinkEmail({ email, url }: MagicLinkEmailInput) {
  await mailer.send({
    to: email,
    subject: "Your Sheet Happens sign-in link",
    text: `Use this link to sign in to Sheet Happens:\n\n${url}\n\nThis link expires shortly.`,
    html: `<p>Use this link to sign in to Sheet Happens:</p><p><a href="${url}">Sign in</a></p><p>This link expires shortly.</p>`,
  });
}

export async function sendInvitationEmail({ email, name, acceptUrl }: InvitationEmailInput) {
  await mailer.send({
    to: email,
    subject: "You have been invited to Sheet Happens",
    text: `Hi ${name},\n\nYou have been invited to Sheet Happens. Open this link to accept the invitation:\n\n${acceptUrl}\n\nThis invitation link expires in ${INVITATION_VALIDITY_HOURS} hours.\n`,
    html: `<p>Hi ${name},</p><p>You have been invited to Sheet Happens.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This invitation link expires in ${INVITATION_VALIDITY_HOURS} hours.</p>`,
  });
}

export async function sendPasswordResetEmail({ email, url }: PasswordResetEmailInput) {
  await mailer.send({
    to: email,
    subject: "Reset your Sheet Happens password",
    text: `Use this link to set a new Sheet Happens password:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Use this link to set a new Sheet Happens password:</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}
