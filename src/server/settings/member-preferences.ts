import { createHash, randomUUID } from "node:crypto";

import { isSupportedTimeZone, normalizeTimeZone } from "@/src/lib/member-preferences";
import { isDurationDisplayFormat, type DurationDisplayFormat } from "@/src/lib/formatting";
import { prisma } from "@/src/server/db/client";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";

export const MEMBER_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const MEMBER_AVATAR_SIGNED_URL_TTL_SECONDS = 5 * 60;

export type MemberPreferenceRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type MemberAvatarFile = {
  bytes: Buffer;
  originalFilename: string;
  contentType: string;
  byteSize: number;
};

export class MemberPreferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberPreferenceError";
  }
}

export async function uploadMemberAvatar(
  input: {
    memberId: string;
    file: MemberAvatarFile;
    requestMetadata?: MemberPreferenceRequestMetadata;
  },
  deps: { storage?: ObjectStorage; now?: Date } = {},
) {
  validateMemberAvatar(input.file);
  const storage = deps.storage ?? getObjectStorage();
  const now = deps.now ?? new Date();
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: {
      avatarStorageBucket: true,
      avatarStorageKey: true,
      avatarContentType: true,
      avatarByteSize: true,
    },
  });

  if (!member) throw new MemberPreferenceError("Member not found.");

  const extension = input.file.contentType === "image/png" ? "png" : "jpg";
  const checksumSha256 = createHash("sha256").update(input.file.bytes).digest("hex");
  const objectRef = await storage.putObject({
    key: `avatars/${input.memberId}/${randomUUID()}.${extension}`,
    body: input.file.bytes,
    contentType: input.file.contentType,
    byteSize: input.file.byteSize,
    checksumSha256,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: input.memberId },
        data: {
          avatarStorageBucket: objectRef.bucket,
          avatarStorageKey: objectRef.key,
          avatarContentType: input.file.contentType,
          avatarByteSize: input.file.byteSize,
          avatarUpdatedAt: now,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorMemberId: input.memberId,
          action: "member.avatar_updated",
          targetType: "member",
          targetId: input.memberId,
          before: member.avatarStorageKey
            ? {
                contentType: member.avatarContentType,
                byteSize: member.avatarByteSize?.toString() ?? null,
              }
            : undefined,
          after: {
            contentType: input.file.contentType,
            byteSize: input.file.byteSize,
            checksumSha256,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });
    });
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }

  if (member.avatarStorageBucket && member.avatarStorageKey) {
    await storage
      .deleteObject({ bucket: member.avatarStorageBucket, key: member.avatarStorageKey })
      .catch(() => undefined);
  }
}

export async function deleteMemberAvatar(input: {
  memberId: string;
  requestMetadata?: MemberPreferenceRequestMetadata;
}) {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: {
      avatarStorageBucket: true,
      avatarStorageKey: true,
      avatarContentType: true,
      avatarByteSize: true,
    },
  });

  if (!member) throw new MemberPreferenceError("Member not found.");
  if (!member.avatarStorageBucket || !member.avatarStorageKey) return;

  const storage = getObjectStorage();
  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: input.memberId },
      data: {
        avatarStorageBucket: null,
        avatarStorageKey: null,
        avatarContentType: null,
        avatarByteSize: null,
        avatarUpdatedAt: null,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorMemberId: input.memberId,
        action: "member.avatar_deleted",
        targetType: "member",
        targetId: input.memberId,
        before: {
          contentType: member.avatarContentType,
          byteSize: member.avatarByteSize?.toString() ?? null,
        },
        ...input.requestMetadata,
      },
    });
  });

  await storage
    .deleteObject({ bucket: member.avatarStorageBucket, key: member.avatarStorageKey })
    .catch(() => undefined);
}

export async function updateMemberTimezone(input: {
  memberId: string;
  timezone: string;
  requestMetadata?: MemberPreferenceRequestMetadata;
}) {
  const timezone = normalizeTimeZone(input.timezone);
  if (!isSupportedTimeZone(timezone)) {
    throw new MemberPreferenceError("Unsupported timezone.");
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { timezone: true },
  });
  if (!member) throw new MemberPreferenceError("Member not found.");
  if (member.timezone === timezone) return;

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: input.memberId },
      data: { timezone },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorMemberId: input.memberId,
        action: "member.timezone_updated",
        targetType: "member",
        targetId: input.memberId,
        before: { timezone: member.timezone },
        after: { timezone },
        ...input.requestMetadata,
      },
    });
  });
}

export async function updateMemberDurationDisplayFormat(input: {
  memberId: string;
  durationDisplayFormat: DurationDisplayFormat;
  requestMetadata?: MemberPreferenceRequestMetadata;
}) {
  if (!isDurationDisplayFormat(input.durationDisplayFormat)) {
    throw new MemberPreferenceError("Unsupported duration display format.");
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { durationDisplayFormat: true },
  });
  if (!member) throw new MemberPreferenceError("Member not found.");
  if (member.durationDisplayFormat === input.durationDisplayFormat) return;

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: input.memberId },
      data: { durationDisplayFormat: input.durationDisplayFormat },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorMemberId: input.memberId,
        action: "member.duration_display_format_updated",
        targetType: "member",
        targetId: input.memberId,
        before: { durationDisplayFormat: member.durationDisplayFormat },
        after: { durationDisplayFormat: input.durationDisplayFormat },
        ...input.requestMetadata,
      },
    });
  });
}

export async function createMemberAvatarReadUrl(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { avatarStorageBucket: true, avatarStorageKey: true },
  });
  if (!member?.avatarStorageBucket || !member.avatarStorageKey) {
    throw new MemberPreferenceError("Avatar not found.");
  }

  return getObjectStorage().getSignedReadUrl({
    bucket: member.avatarStorageBucket,
    key: member.avatarStorageKey,
    expiresInSeconds: MEMBER_AVATAR_SIGNED_URL_TTL_SECONDS,
    responseContentDisposition: "inline",
  });
}

export function validateMemberAvatar(file: MemberAvatarFile) {
  if (!file.bytes.length || file.byteSize <= 0) {
    throw new MemberPreferenceError("Avatar image is required.");
  }
  if (file.byteSize > MEMBER_AVATAR_MAX_BYTES) {
    throw new MemberPreferenceError("Avatar image is too large.");
  }
  if (file.contentType !== "image/png" && file.contentType !== "image/jpeg") {
    throw new MemberPreferenceError("Avatar must be a PNG or JPEG image.");
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPng = file.bytes.subarray(0, pngSignature.length).equals(pngSignature);
  const isJpeg = file.bytes[0] === 0xff && file.bytes[1] === 0xd8 && file.bytes[2] === 0xff;
  if (
    (file.contentType === "image/png" && !isPng) ||
    (file.contentType === "image/jpeg" && !isJpeg)
  ) {
    throw new MemberPreferenceError("Avatar must be a PNG or JPEG image.");
  }
}
