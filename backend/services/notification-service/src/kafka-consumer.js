import { kafka } from "../../../shared/kafka.js";

const topics = ["driver.events", "booking.events", "trip.events", "payment.events"];
const groupId = process.env.KAFKA_CONSUMER_GROUP ?? "notification-service";
const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? "local-internal-token";
const notificationUrl = `http://127.0.0.1:${process.env.SERVICE_PORT ?? 3006}/internal/notifications`;

export async function startKafkaConsumer() {
  const consumer = kafka.consumer({
    groupId,
  });

  await consumer.connect();
  for (const topic of topics) await consumer.subscribe({ topic, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      let event;
      try {
        event = JSON.parse(message.value.toString("utf8"));
      } catch (error) {
        console.error(`Invalid Kafka message on ${topic}:`, error.message);
        return;
      }
      if (!event.recipientId || !event.type || !event.resourceId) {
        console.error(`Invalid notification event on ${topic}`);
        return;
      }
      const response = await fetch(notificationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Service-Token": internalToken },
        body: JSON.stringify({
          recipientId: event.recipientId,
          type: event.type,
          resourceId: event.resourceId,
        }),
      });
      if (!response.ok) {
        throw new Error(`notification persistence returned ${response.status}`);
      }
      console.log(`Consumed ${topic}[${partition}] offset ${message.offset} (${event.type})`);
    },
  });
  console.log(`Kafka consumer connected: ${topics.join(", ")} (group ${groupId})`);
}
