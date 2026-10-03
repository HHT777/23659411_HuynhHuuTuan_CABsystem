import { createApp } from "./app.js";
process.env.SERVICE_NAME ??= "payment-service";
process.env.SERVICE_PORT ??= "3005";
process.env.DEPENDENCIES ??= "postgres:5432,kafka:9092";
createApp().listen(Number(process.env.SERVICE_PORT), "0.0.0.0", () =>
  console.log(
    `${process.env.SERVICE_NAME} listening on ${process.env.SERVICE_PORT}`,
  ),
);
