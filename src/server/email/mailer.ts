import nodemailer from "nodemailer";

export type EmailDeliveryMode = "console" | "smtp";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type Mailer = {
  send(message: EmailMessage): Promise<void>;
};

export function getEmailDeliveryMode(value = process.env.AUTH_EMAIL_DELIVERY_MODE) {
  if (value === "smtp") {
    return value;
  }

  return "console";
}

function getEmailFrom() {
  return process.env.AUTH_EMAIL_FROM ?? "Sheet Happens <auth@sheethappens.local>";
}

function createConsoleMailer(): Mailer {
  return {
    async send(message) {
      console.info(
        [
          `[email] To: ${message.to}`,
          `[email] Subject: ${message.subject}`,
          message.text,
          message.html ? `[email] HTML: ${message.html}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  };
}

function createSmtpMailer(): Mailer {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host) {
    throw new Error("SMTP_HOST is required when AUTH_EMAIL_DELIVERY_MODE=smtp.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return {
    async send(message) {
      await transporter.sendMail({
        from: getEmailFrom(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}

export function createMailer(mode = getEmailDeliveryMode()): Mailer {
  if (mode === "smtp") {
    return createSmtpMailer();
  }

  return createConsoleMailer();
}

export const mailer = createMailer();
