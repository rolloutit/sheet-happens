export type MagicLinkEmailInput = {
  email: string;
  url: string;
};

const deliveryMode = process.env.AUTH_EMAIL_DELIVERY_MODE ?? "console";

export async function sendMagicLinkEmail({ email, url }: MagicLinkEmailInput) {
  if (deliveryMode === "console") {
    console.info(`[auth] Magic link for ${email}: ${url}`);
    return;
  }

  throw new Error("Auth email delivery is not configured.");
}
