#!/bin/sh
# Vercel's build for apps/web. Production deploys bring the database up to date first; previews never touch it.
set -e
cd "$(dirname "$0")/.."
if [ "$VERCEL_ENV" = "production" ]; then
  # Migrations need a direct connection; Neon's default address goes through its pooler.
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" pnpm --filter @mteam/db db:deploy
fi
pnpm turbo run build --filter=@mteam/web
