# ---- build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Install scripts are skipped: the runtime image uses the system ffmpeg instead of ffmpeg-static's download.
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:24-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    DATA_DIR=/app/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
