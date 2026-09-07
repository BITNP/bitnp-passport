FROM ghcr.io/pnpm/pnpm:12.3.4 AS base
RUN pnpm runtime set node 26 -g
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.output ./.output
COPY --from=build /app/backend ./backend
COPY --from=build /app/database ./database
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/shared ./shared
COPY --from=build /app/workers ./workers
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
