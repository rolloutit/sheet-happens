import { Prisma } from "@/src/server/db/generated/client";
import { InfoPageStatus } from "@/src/server/db/generated/enums";
import { prisma } from "@/src/server/db/client";

export const HELP_WELCOME_INFO_PAGE_SLUG = "help-welcome";

export type InfoPageRequestMetadata = {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type PublishedInfoPage = {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  version: number;
  updatedAt: Date;
  publishedAt: Date;
};

export type EditableInfoPage = {
  id: string | null;
  slug: string;
  title: string;
  bodyMarkdown: string;
  status: "draft" | "published";
  version: number | null;
  updatedAt: Date | null;
};

export type PublishInfoPageInput = {
  slug: string;
  title: string;
  bodyMarkdown: string;
  actorMemberId: string;
  requestMetadata?: InfoPageRequestMetadata;
};

export async function getPublishedInfoPage(slug: string): Promise<PublishedInfoPage | null> {
  const page = await prisma.infoPage.findFirst({
    where: {
      slug,
      status: InfoPageStatus.PUBLISHED,
      publishedVersionId: {
        not: null,
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      updatedAt: true,
      publishedVersion: {
        select: {
          title: true,
          bodyMarkdown: true,
          version: true,
          createdAt: true,
        },
      },
    },
  });

  if (!page?.publishedVersion) return null;

  return {
    id: page.id,
    slug: page.slug,
    title: page.publishedVersion.title || page.title,
    bodyMarkdown: page.publishedVersion.bodyMarkdown,
    version: page.publishedVersion.version,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedVersion.createdAt,
  };
}

export async function getEditableInfoPage(slug: string): Promise<EditableInfoPage | null> {
  const page = await prisma.infoPage.findUnique({
    where: {
      slug,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      versions: {
        orderBy: {
          version: "desc",
        },
        take: 1,
        select: {
          title: true,
          bodyMarkdown: true,
          version: true,
        },
      },
    },
  });

  if (!page) return null;

  const latestVersion = page.versions[0] ?? null;

  return {
    id: page.id,
    slug: page.slug,
    title: latestVersion?.title || page.title,
    bodyMarkdown: latestVersion?.bodyMarkdown || "",
    status: page.status === InfoPageStatus.PUBLISHED ? "published" : "draft",
    version: latestVersion?.version ?? null,
    updatedAt: page.updatedAt,
  };
}

export async function publishInfoPage(input: PublishInfoPageInput): Promise<PublishedInfoPage> {
  return prisma.$transaction(async (tx) => {
    const existingPage = await tx.infoPage.findUnique({
      where: {
        slug: input.slug,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publishedVersionId: true,
        publishedVersion: {
          select: {
            title: true,
            bodyMarkdown: true,
            version: true,
          },
        },
        versions: {
          orderBy: {
            version: "desc",
          },
          take: 1,
          select: {
            version: true,
          },
        },
      },
    });

    const page =
      existingPage ??
      (await tx.infoPage.create({
        data: {
          slug: input.slug,
          title: input.title,
          status: InfoPageStatus.DRAFT,
          createdByMemberId: input.actorMemberId,
          updatedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          publishedVersionId: true,
          publishedVersion: {
            select: {
              title: true,
              bodyMarkdown: true,
              version: true,
            },
          },
          versions: {
            orderBy: {
              version: "desc",
            },
            take: 1,
            select: {
              version: true,
            },
          },
        },
      }));

    const nextVersion = (page.versions[0]?.version ?? 0) + 1;
    const version = await tx.infoPageVersion.create({
      data: {
        infoPageId: page.id,
        version: nextVersion,
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        createdByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
        title: true,
        bodyMarkdown: true,
        version: true,
        createdAt: true,
      },
    });

    const updatedPage = await tx.infoPage.update({
      where: {
        id: page.id,
      },
      data: {
        title: input.title,
        status: InfoPageStatus.PUBLISHED,
        publishedVersionId: version.id,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "info_pages.publish",
        targetType: "info_page",
        targetId: page.id,
        before: page.publishedVersion
          ? {
              status: page.status,
              title: page.publishedVersion.title,
              version: page.publishedVersion.version,
              bodyMarkdown: page.publishedVersion.bodyMarkdown,
            }
          : existingPage
            ? {
                status: page.status,
                title: page.title,
                publishedVersionId: page.publishedVersionId,
              }
            : Prisma.JsonNull,
        after: {
          status: InfoPageStatus.PUBLISHED,
          title: version.title,
          version: version.version,
          bodyMarkdown: version.bodyMarkdown,
        },
        requestId: input.requestMetadata?.requestId ?? null,
        ipAddress: input.requestMetadata?.ipAddress ?? null,
        userAgent: input.requestMetadata?.userAgent ?? null,
      },
    });

    return {
      id: updatedPage.id,
      slug: updatedPage.slug,
      title: version.title || updatedPage.title,
      bodyMarkdown: version.bodyMarkdown,
      version: version.version,
      updatedAt: updatedPage.updatedAt,
      publishedAt: version.createdAt,
    };
  });
}
