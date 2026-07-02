import { mailer } from "@/src/server/email/mailer";

export type MagicLinkEmailInput = {
  email: string;
  url: string;
};

export type InvitationEmailInput = {
  email: string;
  name: string;
  acceptUrl: string;
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
    text: `Hi ${name},\n\nYou have been invited to Sheet Happens. Open this link to accept the invitation:\n\n${acceptUrl}\n\n`,
    html: `<p>Hi ${name},</p><p>You have been invited to Sheet Happens.</p><p><a href="${acceptUrl}">Accept invitation</a></p>`,
  });
}
