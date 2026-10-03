# CAB System Backend

The implementation lives under this folder and uses Node.js LTS with Express.

- `gateway/`: the only host-facing HTTP entry point.
- `services/`: entry points for seven independently deployed services.
- `shared/`: the small Express runtime shared by services and versioned contracts.
- `infra/`: database initialization assets.

PC9-PC30 workflows are implemented in `shared/service-runtime.js`; `shared/persistence.js` persists each owner's state in PostgreSQL or MongoDB and commits idempotency responses with business data. `scripts/generate-postman.js` maintains the grading collection. See [running Postman and database clients](../document/database-and-postman.md).
