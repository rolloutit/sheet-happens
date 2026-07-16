"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import {
  requireActiveAppMemberForAction,
  requireSecuritySettingsAppMember,
} from "@/src/server/auth/app-access";
import { clearSecondFactorCookie } from "@/src/server/auth/second-factor";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { prisma } from "@/src/server/db/client";
import type {
  DeletePasskeyActionInput,
  RenamePasskeyActionInput,
  SecuritySettingsActionState,
} from "./actions.types";

type SettingsActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export async function renamePasskeyAction(
  input: RenamePasskeyActionInput,
): Promise<SecuritySettingsActionState> {
  const t = await getTranslations("SettingsActions");
  const name = normalizePasskeyName(input.name);

  if (!input.passkeyId) {
    return {
      status: "error",
      message: t("errors.passkeyIdMissing"),
    };
  }

  if (!name) {
    return {
      status: "error",
      message: t("errors.passkeyNameRequired"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    const requestHeaders = await headers();

    if (!member.authUserId) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        id: input.passkeyId,
        userId: member.authUserId,
      },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
      },
    });

    if (!passkey) {
      return {
        status: "error",
        message: t("errors.passkeyNotFound"),
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.passkey.update({
        where: {
          id: passkey.id,
        },
        data: {
          name,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: member.id,
          action: "security.passkey_renamed",
          targetType: "passkey",
          targetId: passkey.id,
          before: {
            name: passkey.name,
          },
          after: {
            name,
            deviceType: passkey.deviceType,
            backedUp: passkey.backedUp,
          },
          ipAddress: requestHeaders.get("x-forwarded-for"),
          userAgent: requestHeaders.get("user-agent"),
        },
      });
    });

    revalidatePath("/settings");

    return {
      status: "success",
      message: t("success.passkeyRenamed"),
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: translateSettingsActionMessage(error.message, t),
      };
    }

    return {
      status: "error",
      message: t("errors.passkeyRenameFailed"),
    };
  }
}

export async function deletePasskeyAction(
  input: DeletePasskeyActionInput,
): Promise<SecuritySettingsActionState> {
  const t = await getTranslations("SettingsActions");

  if (!input.passkeyId) {
    return {
      status: "error",
      message: t("errors.passkeyIdMissing"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    const requestHeaders = await headers();

    if (!member.authUserId) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        id: input.passkeyId,
        userId: member.authUserId,
      },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        transports: true,
        createdAt: true,
      },
    });

    if (!passkey) {
      return {
        status: "error",
        message: t("errors.passkeyNotFound"),
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.passkey.delete({
        where: {
          id: passkey.id,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: member.id,
          action: "security.passkey_deleted",
          targetType: "passkey",
          targetId: passkey.id,
          before: {
            name: passkey.name,
            deviceType: passkey.deviceType,
            backedUp: passkey.backedUp,
            transports: passkey.transports,
            createdAt: passkey.createdAt?.toISOString() ?? null,
          },
          ipAddress: requestHeaders.get("x-forwarded-for"),
          userAgent: requestHeaders.get("user-agent"),
        },
      });
    });

    revalidatePath("/settings");

    return {
      status: "success",
      message: t("success.passkeyRemoved"),
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: translateSettingsActionMessage(error.message, t),
      };
    }

    return {
      status: "error",
      message: t("errors.passkeyRemoveFailed"),
    };
  }
}

export async function auditTotpDisabledAction(): Promise<SecuritySettingsActionState> {
  const t = await getTranslations("SettingsActions");

  try {
    const { member } = await requireSecuritySettingsAppMember("/settings");
    const requestHeaders = await headers();

    if (!member.authUserId) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    await prisma.auditLog.create({
      data: {
        actorMemberId: member.id,
        action: "security.totp_disabled",
        targetType: "member",
        targetId: member.id,
        after: {
          authUserId: member.authUserId,
        },
        ipAddress: requestHeaders.get("x-forwarded-for"),
        userAgent: requestHeaders.get("user-agent"),
      },
    });
    await clearSecondFactorCookie();
    revalidatePath("/settings");

    return {
      status: "success",
      message: t("success.totpDisabledAudited"),
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: translateSettingsActionMessage(error.message, t),
      };
    }

    return {
      status: "error",
      message: t("errors.totpDisableAuditFailed"),
    };
  }
}

export async function auditBackupCodesRegeneratedAction(): Promise<SecuritySettingsActionState> {
  const t = await getTranslations("SettingsActions");

  try {
    const { member } = await requireSecuritySettingsAppMember("/settings");
    const requestHeaders = await headers();

    if (!member.authUserId) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    await prisma.auditLog.create({
      data: {
        actorMemberId: member.id,
        action: "security.backup_codes_regenerated",
        targetType: "member",
        targetId: member.id,
        after: {
          authUserId: member.authUserId,
        },
        ipAddress: requestHeaders.get("x-forwarded-for"),
        userAgent: requestHeaders.get("user-agent"),
      },
    });
    revalidatePath("/settings");

    return {
      status: "success",
      message: t("success.backupCodesRegeneratedAudited"),
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: translateSettingsActionMessage(error.message, t),
      };
    }

    return {
      status: "error",
      message: t("errors.backupCodesAuditFailed"),
    };
  }
}

function normalizePasskeyName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

function translateSettingsActionMessage(message: string, t: SettingsActionsTranslator) {
  if (message === "No auth account is linked to this member.") {
    return t("errors.noAuthAccount");
  }

  return message;
}
