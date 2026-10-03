FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/driver-service/src ./services/driver-service/src
EXPOSE 3002
CMD ["node", "services/driver-service/src/index.js"]
