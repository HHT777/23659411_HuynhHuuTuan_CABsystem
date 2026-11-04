import { createApp } from "./app.js";
import { startKafkaConsumer } from "./kafka-consumer.js";
process.env.SERVICE_NAME ??= "notification-service";
process.env.SERVICE_PORT ??= "3006";
process.env.DEPENDENCIES ??= "mongodb:27017,kafka:9092";
createApp().listen(Number(process.env.SERVICE_PORT), "0.0.0.0", () =>
  console.log(
    `${process.env.SERVICE_NAME} listening on ${process.env.SERVICE_PORT}`,
  ),
);
startKafkaConsumer().catch((error) => {
  console.error("Kafka consumer failed to start:", error);
  process.exitCode = 1;
});
