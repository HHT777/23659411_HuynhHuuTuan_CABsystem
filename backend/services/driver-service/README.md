# driver-service

Owns Driver, vehicle, availability, location, OTP, and reservation state. Express REST port `3002`, PostgreSQL plus Redis. Endpoint ownership is declared in `src/api/http/endpoints.routes.js`; test public paths through Gateway port `8000`.
