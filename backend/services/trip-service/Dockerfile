FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/trip-service/src ./services/trip-service/src
EXPOSE 3004
CMD ["node", "services/trip-service/src/index.js"]
