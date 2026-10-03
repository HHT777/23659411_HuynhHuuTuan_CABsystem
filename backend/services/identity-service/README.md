# identity-service

Owns Identity/Account. Express REST port `3000`, PostgreSQL `cab_identity_db`, and Kafka events. Endpoint ownership is declared in `src/api/http/endpoints.routes.js`; test public paths through Gateway port `8000`.
