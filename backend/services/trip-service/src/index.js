import { createApp } from "./app.js";
process.env.SERVICE_NAME ??= "trip-service";
process.env.SERVICE_PORT ??= "3004";
process.env.DEPENDENCIES ??= "postgres:5432,redis:6379,kafka:9092";
createApp().listen(Number(process.env.SERVICE_PORT), "0.0.0.0", () =>
  console.log(
    `${process.env.SERVICE_NAME} listening on ${process.env.SERVICE_PORT}`,
  ),
);
