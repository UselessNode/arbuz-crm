FROM oven/bun:1.4.2 AS build

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

COPY . .

# Prisma client is needed for shared types
RUN bun db:generate

WORKDIR /app/apps/frontend
RUN bun run build

FROM nginx:alpine

COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
