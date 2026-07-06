"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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

export async function renamePasskeyAction(
  input: RenamePasskeyActionInput,
): Promise<SecuritySettingsActionState> {
  const name = normalizePasskeyName(input.name);

  if (!input.passkeyId) {
    return {
      status: "error",
      message: "Passkey id is missing.",
    };
  }

  if (!name) {
    return {
      status: "error",
      message: "Passkey name is required.",
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
        message: "Passkey not found.",
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
      message: "Passkey renamed.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "Could not rename the passkey.",
    };
  }
}

export async function deletePasskeyAction(
  input: DeletePasskeyActionInput,
): Promise<SecuritySettingsActionState> {
  if (!input.passkeyId) {
    return {
      status: "error",
      message: "Passkey id is missing.",
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
        message: "Passkey not found.",
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
      message: "Passkey removed.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "Could not remove the passkey.",
    };
  }
}

export async function auditTotpDisabledAction(): Promise<SecuritySettingsActionState> {
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
      message: "Authenticator app disablement audited.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "Authenticator app was disabled, but the audit event could not be recorded.",
    };
  }
}

export async function auditBackupCodesRegeneratedAction(): Promise<SecuritySettingsActionState> {
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
      message: "Backup-code regeneration audited.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "Backup codes were regenerated, but the audit event could not be recorded.",
    };
  }
}

function normalizePasskeyName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}
