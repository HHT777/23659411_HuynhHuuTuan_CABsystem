# Gateway

Public Express entry point on port 8000. It owns route selection, request IDs, the internal-route boundary, and aggregate health. Business rules remain in the seven services. Downstream business routes are intentionally not implemented in PC1-PC8.
