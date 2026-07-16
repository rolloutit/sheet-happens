"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { prisma } from "@/src/server/db/client";
import { getCurrentMember } from "@/src/server/auth/session";
import { isSupportedLocale, localeCookieName, type AppLocale } from "./locales";

export type SetLocaleActionState =
  | {
      status: "success";
      locale: AppLocale;
    }
  | {
      status: "error";
      message: string;
    };

export async function setLocaleAction(locale: string): Promise<SetLocaleActionState> {
  if (!isSupportedLocale(locale)) {
    return {
      status: "error",
      message: "Unsupported language.",
    };
  }

  const requestCookies = await cookies();
  requestCookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  const member = await getCurrentMember();

  if (member && member.locale !== locale) {
    await prisma.member.update({
      where: {
        id: member.id,
      },
      data: {
        locale,
      },
      select: {
        id: true,
      },
    });
  }

  revalidatePath("/", "layout");

  return {
    status: "success",
    locale,
  };
}
