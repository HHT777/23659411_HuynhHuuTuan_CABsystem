FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/payment-service/src ./services/payment-service/src
EXPOSE 3005
CMD ["node", "services/payment-service/src/index.js"]
