FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/customer-service/src ./services/customer-service/src
EXPOSE 3001
CMD ["node", "services/customer-service/src/index.js"]
