# CAB System Backend

The stack contains a Node.js/Express Gateway, seven services, Kafka, Redis, PostgreSQL, and MongoDB. Only Gateway publishes HTTP port `8000`. Service ports, PostgreSQL `5432`, and MongoDB `27017` are available only inside the Docker network and are not published to the host.

Business workflows cover the Postman criteria in `phieucham.md`, with PostgreSQL/MongoDB persistence, JWT/RBAC, driver onboarding, booking/trip lifecycle, sandbox payment callbacks, reviews and replay protection. Public API base URL is `http://localhost:8000/api/v1`; open `GET http://localhost:8000/api/v1/endpoints` or see [the endpoint catalog](document/endpoints.md). See [Postman and database setup](document/database-and-postman.md) for exact connection settings, demo accounts, scope and validation commands.

```powershell
node backend/scripts/setup-local-secrets.js
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
docker compose ps
```

Gateway health endpoints are `GET http://localhost:8000/health`, `/ready`, and `/health/services`. Service requests require `X-Service-Token`; `/internal/*` is blocked at Gateway. Import `postman/CAB-phieucham.postman_collection.json`, or run `node backend/scripts/run-postman.js` after installing backend dependencies.
