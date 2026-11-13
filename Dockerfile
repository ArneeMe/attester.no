# The API (apps/api) as one bundled file on a small Node image.
# Build from the repo root: docker build -t attester-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts -w @attester/api -w @attester/shared
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build -w @attester/api

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY --from=build /repo/apps/api/dist/server.js /repo/apps/api/dist/server.js.map ./
USER node
EXPOSE 8787
CMD ["node", "--enable-source-maps", "server.js"]
