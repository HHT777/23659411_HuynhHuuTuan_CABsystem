FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/booking-service/src ./services/booking-service/src
EXPOSE 3003
CMD ["node", "services/booking-service/src/index.js"]
