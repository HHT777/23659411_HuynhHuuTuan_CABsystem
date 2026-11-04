import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? process.env.SERVICE_NAME ?? "cab-service",
  brokers: (process.env.KAFKA_BROKERS ?? "kafka:9092").split(",").map((value) => value.trim()).filter(Boolean),
});

let producerPromise;

async function producer() {
  if (!producerPromise) {
    const client = kafka.producer();
    producerPromise = client.connect().then(() => client);
  }
  return producerPromise;
}

const topicForType = (type) => {
  if (type.startsWith("DRIVER_")) return "driver.events";
  if (type.startsWith("BOOKING_") || type === "DRIVER_ASSIGNED") return "booking.events";
  if (type.startsWith("TRIP_")) return "trip.events";
  if (type.startsWith("PAYMENT_")) return "payment.events";
  return null;
};

export async function publishNotificationEvent({ recipientId, type, resourceId }) {
  const topic = topicForType(type);
  if (!topic) throw new Error(`No Kafka topic configured for notification type ${type}`);
  const client = await producer();
  await client.send({
    topic,
    messages: [{
      key: String(resourceId),
      value: JSON.stringify({ recipientId, type, resourceId, occurredAt: new Date().toISOString() }),
    }],
  });
  return { topic };
}

export { kafka };
