# ---------------------------------------------------------------------------
# Self-hosted Mintlify build:
#   1. Run preset/api-reference generators against repo content
#   2. Run `mintlify export` to produce a static-site zip (export.zip)
#   3. Unzip into nginx html root and serve as a static site
#
# Mintlify's officially-supported self-host path is `mintlify export`, which
# emits a fully static bundle (no Node runtime required at serve time).
# We do NOT use `mintlify build` — that command does not exist in mintlify v4.
#
# `npm install` (not `npm ci`) is intentional: this package is workspace-
# isolated (root pnpm/npm workspaces exclude apps/docs to avoid pulling
# Mintlify's React tree into the gateway/dashboard install graph), and
# package-lock.json is not always committed alongside content edits.
# ---------------------------------------------------------------------------

FROM mirror.gcr.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

COPY . .

ARG BUILD_REVISION=local
ARG SENTRY_TRACES_SAMPLE_RATE=0.02
RUN --mount=type=secret,id=sentry_dsn \
  mkdir -p dist \
  && npm run build \
  && node scripts/extract-export.mjs dist/export.zip dist/site \
  && SENTRY_DSN="$(cat /run/secrets/sentry_dsn 2>/dev/null || true)" \
  SENTRY_ENVIRONMENT="production" \
  SENTRY_RELEASE="${BUILD_REVISION}" \
  SENTRY_SERVICE="datari-docs" \
  SENTRY_TRACES_SAMPLE_RATE="${SENTRY_TRACES_SAMPLE_RATE}" \
  node scripts/inject-sentry.mjs dist/site \
  && ls -la dist/site | head -20

FROM mirror.gcr.io/library/nginx:1.29-alpine AS runtime

COPY --from=build /app/dist/site /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
