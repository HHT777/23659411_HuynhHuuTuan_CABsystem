FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json gateway/package.json
COPY services services
RUN npm ci --omit=dev
COPY shared ./shared
COPY gateway/package.json ./gateway/package.json
COPY gateway/src ./gateway/src
EXPOSE 8000
CMD ["node", "gateway/src/index.js"]
