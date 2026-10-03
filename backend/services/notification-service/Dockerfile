FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/notification-service/src ./services/notification-service/src
EXPOSE 3006
CMD ["node", "services/notification-service/src/index.js"]
