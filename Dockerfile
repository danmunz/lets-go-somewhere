FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY backend/package.json backend/tsconfig.json ./backend/
RUN npm ci
COPY shared ./shared
COPY backend ./backend
COPY seed ./seed
RUN npm run build -w shared && npm run build -w backend

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/seed ./seed
CMD ["node", "backend/dist/server.js"]
