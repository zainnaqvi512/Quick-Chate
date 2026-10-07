FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY db/migrations ./db/migrations
COPY scripts/start-preview.mjs ./scripts/start-preview.mjs
EXPOSE 3000
CMD ["node", "dist/boot.js"]
