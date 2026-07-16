import {
  defaultLocale,
  isSupportedLocale,
  resolveLocale,
  type AppLocale,
} from "@/src/i18n/locales";
import { prisma } from "@/src/server/db/client";
import { mailer } from "@/src/server/email/mailer";
import { INVITATION_VALIDITY_HOURS } from "@/src/server/users/invitation-expiry";

export type MagicLinkEmailInput = {
  email: string;
  url: string;
  locale?: string;
};

export type InvitationEmailInput = {
  email: string;
  name: string;
  acceptUrl: string;
  locale?: string;
};

export type PasswordResetEmailInput = {
  email: string;
  url: string;
  locale?: string;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export async function sendMagicLinkEmail({ email, url, locale }: MagicLinkEmailInput) {
  const resolvedLocale = await resolveEmailLocale(email, locale);
  const content = buildMagicLinkEmail(resolvedLocale, url);

  await mailer.send({
    to: email,
    ...content,
  });
}

export async function sendInvitationEmail({
  email,
  name,
  acceptUrl,
  locale,
}: InvitationEmailInput) {
  const resolvedLocale = await resolveEmailLocale(email, locale);
  const content = buildInvitationEmail(resolvedLocale, name, acceptUrl);

  await mailer.send({
    to: email,
    ...content,
  });
}

export async function sendPasswordResetEmail({ email, url, locale }: PasswordResetEmailInput) {
  const resolvedLocale = await resolveEmailLocale(email, locale);
  const content = buildPasswordResetEmail(resolvedLocale, url);

  await mailer.send({
    to: email,
    ...content,
  });
}

async function resolveEmailLocale(email: string, locale: string | undefined): Promise<AppLocale> {
  if (isSupportedLocale(locale)) return locale;

  const member = await prisma.member.findUnique({
    where: {
      email: email.trim().toLowerCase(),
    },
    select: {
      locale: true,
    },
  });

  return resolveLocale(member?.locale) ?? defaultLocale;
}

function buildMagicLinkEmail(locale: AppLocale, url: string): EmailContent {
  if (locale === "hu") {
    return {
      subject: "Sheet Happens bejelentkezési link",
      text: `Ezzel a linkkel jelentkezhetsz be a Sheet Happensbe:\n\n${url}\n\nA link rövid ideig érvényes.`,
      html: [
        "<p>Ezzel a linkkel jelentkezhetsz be a Sheet Happensbe:</p>",
        `<p><a href="${escapeHtml(url)}">Bejelentkezés</a></p>`,
        "<p>A link rövid ideig érvényes.</p>",
      ].join(""),
    };
  }

  return {
    subject: "Your Sheet Happens sign-in link",
    text: `Use this link to sign in to Sheet Happens:\n\n${url}\n\nThis link expires shortly.`,
    html: [
      "<p>Use this link to sign in to Sheet Happens:</p>",
      `<p><a href="${escapeHtml(url)}">Sign in</a></p>`,
      "<p>This link expires shortly.</p>",
    ].join(""),
  };
}

function buildInvitationEmail(locale: AppLocale, name: string, acceptUrl: string): EmailContent {
  if (locale === "hu") {
    return {
      subject: "Meghívást kaptál a Sheet Happensbe",
      text: `Szia ${name}!\n\nMeghívást kaptál a Sheet Happensbe. A meghívó elfogadásához nyisd meg ezt a linket:\n\n${acceptUrl}\n\nA meghívólink ${INVITATION_VALIDITY_HOURS} óráig érvényes.\n`,
      html: [
        `<p>Szia ${escapeHtml(name)}!</p>`,
        "<p>Meghívást kaptál a Sheet Happensbe.</p>",
        `<p><a href="${escapeHtml(acceptUrl)}">Meghívó elfogadása</a></p>`,
        `<p>A meghívólink ${INVITATION_VALIDITY_HOURS} óráig érvényes.</p>`,
      ].join(""),
    };
  }

  return {
    subject: "You have been invited to Sheet Happens",
    text: `Hi ${name},\n\nYou have been invited to Sheet Happens. Open this link to accept the invitation:\n\n${acceptUrl}\n\nThis invitation link expires in ${INVITATION_VALIDITY_HOURS} hours.\n`,
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      "<p>You have been invited to Sheet Happens.</p>",
      `<p><a href="${escapeHtml(acceptUrl)}">Accept invitation</a></p>`,
      `<p>This invitation link expires in ${INVITATION_VALIDITY_HOURS} hours.</p>`,
    ].join(""),
  };
}

function buildPasswordResetEmail(locale: AppLocale, url: string): EmailContent {
  if (locale === "hu") {
    return {
      subject: "Sheet Happens jelszó beállítása",
      text: `Ezzel a linkkel állíthatsz be új Sheet Happens jelszót:\n\n${url}\n\nHa nem te kérted, hagyd figyelmen kívül ezt az emailt.`,
      html: [
        "<p>Ezzel a linkkel állíthatsz be új Sheet Happens jelszót:</p>",
        `<p><a href="${escapeHtml(url)}">Jelszó beállítása</a></p>`,
        "<p>Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.</p>",
      ].join(""),
    };
  }

  return {
    subject: "Reset your Sheet Happens password",
    text: `Use this link to set a new Sheet Happens password:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: [
      "<p>Use this link to set a new Sheet Happens password:</p>",
      `<p><a href="${escapeHtml(url)}">Reset password</a></p>`,
      "<p>If you did not request this, ignore this email.</p>",
    ].join(""),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
