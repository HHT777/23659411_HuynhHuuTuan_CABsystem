import { createGatewayApp } from "./app.js";
import { gatewayConfig } from "./config/env.js";

const { port } = gatewayConfig();
createGatewayApp().listen(port, "0.0.0.0", () =>
  console.log(`gateway listening on ${port}`),
);
