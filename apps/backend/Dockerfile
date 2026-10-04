FROM oven/bun:1.4.2

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile

COPY . .

RUN bun db:generate

WORKDIR /app/apps/backend
EXPOSE 3000

CMD ["bun", "run", "index.ts"]
