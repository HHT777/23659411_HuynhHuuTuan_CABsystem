FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY services/identity-service/src ./services/identity-service/src
EXPOSE 3000
CMD ["node", "services/identity-service/src/index.js"]
