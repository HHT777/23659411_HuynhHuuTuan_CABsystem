# notification-service

Owns Notification inbox and Kafka consumers. Express REST port `3006`, MongoDB replica set plus Kafka. Endpoint ownership is declared in `src/api/http/endpoints.routes.js`; test public paths through Gateway port `8000`.
