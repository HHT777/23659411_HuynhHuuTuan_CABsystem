\set ON_ERROR_STOP on

-- Practice data: 10 customers, 10 matching drivers, 3 completed bookings per customer.
-- Password for all customers and drivers: 12345678.
-- Practice admin: adm01@gmail.com / 12345678.
-- Run with psql against the postgres container after the services have created their tables.
-- Only the fixed practice IDs below are replaced; other user data is retained.

\connect cab_identity_db
BEGIN;
DELETE FROM users WHERE id IN (
  SELECT '10000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 10) i
  UNION ALL
  SELECT '20000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 10) i
  UNION ALL
  SELECT '30000000-0000-4000-8000-000000000001'
);
WITH people AS (
  SELECT i, '10000000-0000-4000-8000-' || lpad(i::text, 12, '0') AS id,
    'Khach Hang ' || lpad(i::text, 2, '0') AS full_name,
    'kh' || lpad(i::text, 2, '0') || '@gmail.com' AS email,
    '0390000' || lpad(i::text, 3, '0') AS phone,
    'CUSTOMER' AS role FROM generate_series(1, 10) i
  UNION ALL
  SELECT i, '20000000-0000-4000-8000-' || lpad(i::text, 12, '0'),
    'Driver ' || lpad(i::text, 2, '0'),
    'dr' || lpad(i::text, 2, '0') || '@gmail.com',
    '0391234' || lpad(i::text, 3, '0'), 'DRIVER'
  FROM generate_series(1, 10) i
  UNION ALL
  SELECT 1, '30000000-0000-4000-8000-000000000001',
    'Admin Practice', 'adm01@gmail.com', '0399000001', 'ADMIN'
), accounts AS (
  SELECT *, 'ACTIVE' AS status FROM people
)
INSERT INTO users (id, data, profile_id, full_name, email, phone, password_hash, role, status, created_at, updated_at)
SELECT id, jsonb_build_object('id', id, 'profileId', id, 'fullName', full_name,
  'email', email, 'phone', phone, 'password',
  'scrypt:1d149949dad40630ca8e755084cd9bd6:3cdd22c6101ff08a76b88e4766c5942ca0012c8d386e3df68a28677fcd67fd48',
  'role', role, 'status', status),
  id, full_name, email, phone,
  'scrypt:1d149949dad40630ca8e755084cd9bd6:3cdd22c6101ff08a76b88e4766c5942ca0012c8d386e3df68a28677fcd67fd48',
  role, status, now(), now()
FROM accounts;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;

\connect cab_customer_db
BEGIN;
DELETE FROM customers WHERE id IN (
  SELECT '10000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 10) i
);
WITH people AS (
  SELECT '10000000-0000-4000-8000-' || lpad(i::text, 12, '0') AS id,
    'Khach Hang ' || lpad(i::text, 2, '0') AS full_name,
    'kh' || lpad(i::text, 2, '0') || '@gmail.com' AS email,
    '0390000' || lpad(i::text, 3, '0') AS phone
  FROM generate_series(1, 10) i
)
INSERT INTO customers (id, data, user_id, full_name, email, phone, created_at, updated_at)
SELECT id, jsonb_build_object('id', id, 'userId', id, 'fullName', full_name,
  'email', email, 'phone', phone, 'createdAt', now(), 'updatedAt', now()),
  id, full_name, email, phone, now(), now()
FROM people;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;

\connect cab_driver_db
BEGIN;
DELETE FROM drivers WHERE id IN (
  SELECT '20000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 10) i
);
WITH people AS (
  SELECT i, '20000000-0000-4000-8000-' || lpad(i::text, 12, '0') AS id,
    'Driver ' || lpad(i::text, 2, '0') AS full_name,
    'dr' || lpad(i::text, 2, '0') || '@gmail.com' AS email,
    '0391234' || lpad(i::text, 3, '0') AS phone,
    CASE WHEN i <= 6 THEN 'ONLINE' ELSE 'OFFLINE' END AS status,
    'APPROVED' AS application_status,
    10.776 + ((i - 1) % 4) * 0.001 AS lat,
    106.701 + ((i - 1) / 4) * 0.001 AS lng
  FROM generate_series(1, 10) i
)
INSERT INTO drivers (id, data, user_id, full_name, vehicle_type, plate,
  status, application_status, latitude, longitude, rating_sum, rating_count, version, created_at, updated_at)
SELECT id, jsonb_build_object('id', id, 'userId', id, 'fullName', full_name,
  'email', email, 'phone', phone, 'vehicleType', 'BIKE',
  'plate', '59A-' || lpad(i::text, 5, '0'), 'status', status,
  'applicationStatus', application_status, 'lat', lat, 'lng', lng,
  'ratingSum', 0, 'ratingCount', 0, 'version', 1),
  id, full_name, 'BIKE', '59A-' || lpad(i::text, 5, '0'),
  status, application_status, lat, lng, 0, 0, 1, now(), now()
FROM people;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;

\connect cab_booking_db
BEGIN;
DELETE FROM offers WHERE booking_id IN (
  SELECT '40000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 30) i
);
DELETE FROM bookings WHERE id IN (
  SELECT '40000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 30) i
);
WITH rides AS (
  SELECT c, j, (c - 1) * 3 + j AS n,
    '10000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS customer_id,
    '20000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS driver_id,
    jsonb_build_object('address', 'Go Vap', 'lat', 10.776, 'lng', 106.701) AS pickup,
    jsonb_build_object('address', 'IUH', 'lat', 10.797, 'lng', 106.721) AS destination
  FROM generate_series(1, 10) c CROSS JOIN generate_series(1, 3) j
), rows AS (
  SELECT *, '40000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS id,
    '50000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS trip_id,
    28800 AS fare,
    now() - n * interval '1 day' AS requested_at
  FROM rides
)
INSERT INTO bookings (id, data, customer_id, driver_id, trip_id, vehicle_type,
  pickup, destination, dropoff, quoted_fare_vnd, distance_m, status, requested_at)
SELECT id, jsonb_build_object('id', id, 'customerId', customer_id,
  'driverId', driver_id, 'tripId', trip_id, 'vehicleType', 'BIKE',
  'pickup', pickup, 'destination', destination, 'dropoff', destination,
  'quotedFareVnd', fare, 'distanceM', 3198,
  'status', 'COMPLETED', 'requestedAt', requested_at),
  customer_id, driver_id, trip_id, 'BIKE', pickup, destination, destination,
  fare, 3198, 'COMPLETED', requested_at
FROM rows;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;

\connect cab_trip_db
BEGIN;
DELETE FROM trips WHERE id IN (
  SELECT '50000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 30) i
);
WITH rides AS (
  SELECT c, j, (c - 1) * 3 + j AS n,
    '10000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS customer_id,
    '20000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS driver_id,
    jsonb_build_object('address', 'Go Vap', 'lat', 10.776, 'lng', 106.701) AS pickup,
    jsonb_build_object('address', 'IUH', 'lat', 10.797, 'lng', 106.721) AS destination
  FROM generate_series(1, 10) c CROSS JOIN generate_series(1, 3) j
), rows AS (
  SELECT *, '50000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS id,
    '40000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS booking_id,
    CASE WHEN j = 2 THEN 'UNPAID' ELSE 'PAID' END AS payment_status,
    CASE WHEN j = 1 THEN NULL ELSE jsonb_build_object(
      'reviewId', '70000000-0000-4000-8000-' || lpad(n::text, 12, '0'),
      'tripId', '50000000-0000-4000-8000-' || lpad(n::text, 12, '0'),
      'stars', CASE WHEN j = 2 THEN 4 ELSE 5 END,
      'comment', 'Danh gia chuyen ' || c || '-' || j) END AS review,
    28800 AS fare,
    now() - n * interval '1 day' AS assigned_at
  FROM rides
)
INSERT INTO trips (id, data, booking_id, customer_id, driver_id, status,
  payment_status, amount_vnd, vehicle_type, pickup, destination, dropoff,
  review, assigned_at, arrived_at, started_at, completed_at, version)
SELECT id, jsonb_build_object('id', id, 'bookingId', booking_id,
  'customerId', customer_id, 'driverId', driver_id, 'status', 'COMPLETED',
  'paymentStatus', payment_status, 'amountVnd', fare, 'vehicleType', 'BIKE',
  'pickup', pickup, 'destination', destination, 'dropoff', destination,
  'assignedAt', assigned_at, 'arrivedAt', assigned_at + interval '5 minutes',
  'startedAt', assigned_at + interval '10 minutes',
  'completedAt', assigned_at + interval '30 minutes', 'version', 1)
  || CASE WHEN review IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('review', review) END,
  booking_id, customer_id, driver_id, 'COMPLETED', payment_status, fare,
  'BIKE', pickup, destination, destination, review, assigned_at,
  assigned_at + interval '5 minutes', assigned_at + interval '10 minutes',
  assigned_at + interval '30 minutes', 1
FROM rows;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;

\connect cab_payment_db
BEGIN;
DELETE FROM payments WHERE booking_id IN (
  SELECT '40000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 30) i
) OR id IN (
  SELECT '60000000-0000-4000-8000-' || lpad(i::text, 12, '0') FROM generate_series(1, 30) i
);
WITH rides AS (
  SELECT c, j, (c - 1) * 3 + j AS n
  FROM generate_series(1, 10) c CROSS JOIN (VALUES (1), (3)) AS cases(j)
), rows AS (
  SELECT '60000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS id,
    '40000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS booking_id,
    '50000000-0000-4000-8000-' || lpad(n::text, 12, '0') AS trip_id,
    '10000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS customer_id,
    '20000000-0000-4000-8000-' || lpad(c::text, 12, '0') AS driver_id,
    28800 AS fare,
    now() - n * interval '1 day' + interval '35 minutes' AS paid_at
  FROM rides
)
INSERT INTO payments (id, data, booking_id, trip_id, customer_id, driver_id,
  amount_vnd, status, method, attempt_count, paid_at, created_at, updated_at)
SELECT id, jsonb_build_object('id', id, 'bookingId', booking_id,
  'tripId', trip_id, 'customerId', customer_id, 'driverId', driver_id,
  'amountVnd', fare, 'status', 'COMPLETED', 'method', 'ONLINE',
  'attemptCount', 1, 'paidAt', paid_at, 'createdAt', paid_at,
  'updatedAt', paid_at),
  booking_id, trip_id, customer_id, driver_id, fare, 'COMPLETED',
  'ONLINE', 1, paid_at, paid_at, paid_at
FROM rows;
INSERT INTO runtime_metadata(id) VALUES ('seeded') ON CONFLICT DO NOTHING;
COMMIT;
