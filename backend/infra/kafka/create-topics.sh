#!/usr/bin/env bash
set -eu

for topic in driver.events booking.events trip.events payment.events cab.dead-letter; do
  partitions=3
  if [ "$topic" = "cab.dead-letter" ]; then partitions=1; fi
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server "${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}" --create --if-not-exists --topic "$topic" --partitions "$partitions" --replication-factor 1
done