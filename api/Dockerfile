FROM node:20-alpine

WORKDIR /app

# Build deps for native modules like better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package manifests first for better caching
COPY package.json package-lock.json* ./

# Do NOT use npm ci — lock file is not in sync and will hard-fail.
# npm install will reconcile dependencies and proceed.
RUN npm install --omit=dev

# Copy the rest of the source code (including routes/)
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]