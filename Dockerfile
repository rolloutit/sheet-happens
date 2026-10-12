# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.0
ARG PNPM_VERSION=11.5.3
ARG TYPST_VERSION=0.15.1

FROM node:${NODE_VERSION}-bookworm-slim AS base

ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH="/pnpm:${PATH}"
ENV PNPM_HOME="/pnpm"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate

FROM base AS typst

ARG TYPST_VERSION
ARG TARGETARCH

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  case "${TARGETARCH:-amd64}" in \
    amd64) typst_arch="x86_64" ;; \
    arm64) typst_arch="aarch64" ;; \
    *) echo "Unsupported Docker target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  curl --fail --location --show-error \
    "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${typst_arch}-unknown-linux-musl.tar.xz" \
    --output /tmp/typst.tar.xz; \
  mkdir -p /tmp/typst; \
  tar -xJf /tmp/typst.tar.xz -C /tmp/typst --strip-components=1; \
  install -m 0755 /tmp/typst/typst /usr/local/bin/typst; \
  typst --version

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_ORG_NAME
ARG NEXT_PUBLIC_ORG_LOGO
ARG NEXT_PUBLIC_ORG_LOGO_DARK

RUN pnpm db:generate \
  && BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-local-build-only-secret-please-set-real-value}" \
    BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}" \
    NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}" \
    NEXT_PUBLIC_BETTER_AUTH_URL="${NEXT_PUBLIC_BETTER_AUTH_URL:-http://localhost:3000}" \
    NEXT_PUBLIC_ORG_NAME="${NEXT_PUBLIC_ORG_NAME:-}" \
    NEXT_PUBLIC_ORG_LOGO="${NEXT_PUBLIC_ORG_LOGO:-}" \
    NEXT_PUBLIC_ORG_LOGO_DARK="${NEXT_PUBLIC_ORG_LOGO_DARK:-}" \
    pnpm build

FROM base AS runner

WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV TYPST_BIN=/usr/local/bin/typst

RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY --from=typst /usr/local/bin/typst /usr/local/bin/typst
COPY --from=builder /app ./

RUN typst --version

EXPOSE 3000

CMD ["pnpm", "start"]
