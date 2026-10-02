# API Traceability

Requirement → Use Case → API → Implementation. Mỗi dòng truy được về `SRS.md` (v3.6) hoặc `microservice_design.md` (v3.7); cột Source dùng ký hiệu `§` của từng file.

## REST API (7 service)

Ghi chú: `[internal INT-xx]` = API nội bộ service↔service (Gateway không route cho client); `[health]` = liveness/readiness có credential; còn lại là public API qua Gateway.

| **Service** | **Method** | **Endpoint** | **Use Case / Requirement** | **Source** |
| --- | --- | --- | --- | --- |
| identity | POST | `/auth/register` | UC-02 / FR-02 | SRS.md §6.1, §8.3 UC-02, §9 FR-02, §16.2, §16.2.1; microservice_design.md §5.2.2, §6.1, §9.4.1, §9.6.3 |
| identity | POST | `/auth/login` | UC-03 / FR-03 | SRS.md §6.1, §8.3 UC-03, §9 FR-03, §16.2, §16.2.1, §16.1 RATE_LOGIN; microservice_design.md §5.2.2, §9.4.1 |
| identity | POST | `/internal/accounts/drivers` | [internal INT-02] UC-06 / FR-07 | SRS.md §6.2, §14.1 INT-02, §16.2.1; microservice_design.md §2.4 INT-02, §5.2.3, §6.2 |
| identity | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| identity | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| customer | GET | `/customers/{id}` | UC-04 / FR-04 | SRS.md §8.3 UC-04, §9 FR-04, §16.2, §16.2.1 AUD-22, §16.3; microservice_design.md §5.3.2, §9.4.1 |
| customer | POST | `/internal/customers` | [internal INT-01] UC-02 / FR-02 | SRS.md §6.1, §14.1 INT-01; microservice_design.md §2.4 INT-01, §5.3.3, §6.1 |
| customer | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| customer | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| driver | GET | `/drivers/{id}` | UC-05 / FR-05 | SRS.md §8.3 UC-05, §9 FR-05, §16.2, §16.2.1 AUD-22; microservice_design.md §5.4.2, §9.4.1 |
| driver | POST | `/drivers/otp/request` | UC-06 / FR-06 | SRS.md §6.2, §8.3 UC-06, §16.1 OTP_*/RATE_OTP, §16.2; microservice_design.md §5.4.2, §6.2, §10.4 |
| driver | POST | `/drivers/otp/verify` | UC-06 / FR-06 | SRS.md §6.2, §8.3 UC-06, §16.2, §16.2.1; microservice_design.md §5.4.2, §6.2, §9.6.3 |
| driver | POST | `/drivers/register` | UC-06 / FR-07 | SRS.md §6.2, §8.3 UC-06, §16.2, §16.2.1; microservice_design.md §5.4.2, §6.2, §9.6.3 |
| driver | GET | `/drivers/me/application` | UC-06 / FR-08 | SRS.md §8.3 UC-06, §9 FR-08, §16.2, §16.2.1; microservice_design.md §5.4.2 |
| driver | GET | `/admin/drivers` | UC-07 / FR-09 | SRS.md §6.3, §8.3 UC-07, §9 FR-09, §16.2; microservice_design.md §5.4.2 |
| driver | GET | `/admin/drivers/{id}` | UC-07 / FR-09 | SRS.md §6.3, §8.3 UC-07, §9 FR-09, §16.2, §16.4; microservice_design.md §5.4.2 |
| driver | POST | `/admin/drivers/{id}/approve` | UC-07 / FR-10 | SRS.md §6.3, §8.3 UC-07, §9 FR-10, §16.2; microservice_design.md §5.4.2, §6.3 |
| driver | POST | `/admin/drivers/{id}/reject` | UC-07 / FR-10 | SRS.md §6.3, §8.3 UC-07, §9 FR-10, §16.2; microservice_design.md §5.4.2, §6.3 |
| driver | PUT | `/drivers/me/availability` | UC-08 / FR-11 | SRS.md §6.4, §8.3 UC-08, §9 FR-11, §10 BRULE-06, §16.2, §16.2.1; microservice_design.md §5.4.2 |
| driver | PUT | `/drivers/me/location` | UC-08, UC-14 / FR-12 | SRS.md §6.4, §8.3 UC-08, §9 FR-12, §16.1 RATE_LOCATION, §16.2; microservice_design.md §5.4.2, §6.4 |
| driver | GET | `/drivers/nearby` | UC-09 / FR-13 | SRS.md §6.4, §8.3 UC-09, §9 FR-13, §10 BRULE-07/08, §16.2, §16.2.1 'Nearby'; microservice_design.md §5.4.2, §6.4 |
| driver | GET | `/internal/drivers/nearby` | [internal INT-03] UC-11 / FR-16 | SRS.md §6.5, §10 BRULE-11, §14.1 INT-03, §16.2.1; microservice_design.md §2.4 INT-03, §5.4.3, §9.6.5 |
| driver | POST | `/internal/drivers/{id}/reservations` | [internal INT-04] UC-11, UC-13 / FR-16, FR-19 | SRS.md §6.5, §14.1 INT-04; microservice_design.md §2.4 INT-04, §5.4.3, §9.6.2 |
| driver | DELETE | `/internal/drivers/{id}/reservations/{reservationId}` | [internal INT-05] UC-13, UC-15 / FR-19, FR-22 | SRS.md §14.1 INT-05; microservice_design.md §2.4 INT-05, §5.4.3, §9.6.2 |
| driver | POST | `/internal/drivers/{id}/reservations/{reservationId}/confirm` | [internal INT-08] UC-13 / FR-19 | SRS.md §6.6, §14.1 INT-08; microservice_design.md §2.4 INT-08, §5.4.3, §9.6.2 |
| driver | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| driver | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| booking | POST | `/fare-estimates` | UC-10 / FR-14 | SRS.md §6.5, §8.3 UC-10, §9 FR-14, §16.2, §16.2.1; microservice_design.md §5.5.2, §6.5 |
| booking | POST | `/bookings` | UC-11 / FR-15, FR-16 | SRS.md §6.5, §8.3 UC-11, §9 FR-15/16, §10 BRULE-08/10/21, §16.1 RATE_BOOKING, §16.2; microservice_design.md §5.5.2, §6.5, §9.6.1 |
| booking | GET | `/bookings` | UC-12 / FR-17 | SRS.md §8.3 UC-12, §9 FR-17, §16.2; microservice_design.md §5.5.2 |
| booking | GET | `/bookings/{id}` | UC-11, UC-12 / FR-17 | SRS.md §8.3 UC-11/12, §9 FR-17, §16.2, §16.2.1 AUD-14; microservice_design.md §5.5.2, §6.8 |
| booking | POST | `/bookings/{id}/cancel` | UC-15 / FR-22 | SRS.md §6.8, §8.3 UC-15, §9 FR-22, §10 BRULE-15/16, §16.2, §16.2.1; microservice_design.md §5.5.2, §6.8, §9.6.2 |
| booking | GET | `/offers` | UC-13 / FR-18 | SRS.md §8.3 UC-13, §9 FR-18, §16.2, §16.2.1; microservice_design.md §5.5.2 |
| booking | GET | `/offers/{id}` | UC-13 / FR-18 | SRS.md §8.3 UC-13, §9 FR-18, §16.2; microservice_design.md §5.5.2 |
| booking | POST | `/offers/{id}/accept` | UC-13 / FR-19 | SRS.md §6.6, §8.3 UC-13, §9 FR-19, §16.2; microservice_design.md §5.5.2, §6.6, §9.6.2 |
| booking | POST | `/offers/{id}/reject` | UC-13 / FR-18 | SRS.md §6.5, §8.3 UC-13, §9 FR-18, §16.2, §16.2.1; microservice_design.md §5.5.2 |
| booking | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| booking | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| trip | GET | `/trips/{id}` | UC-13, UC-14 / FR-20 | SRS.md §8.3 UC-13/14, §9 FR-20, §16.2, §16.2.1; microservice_design.md §5.6.2 |
| trip | PATCH | `/trips/{id}/status` | UC-14 / FR-21 | SRS.md §6.7, §8.3 UC-14, §9 FR-21, §16.2, §16.2.1; microservice_design.md §5.6.2, §6.7 |
| trip | POST | `/trips/{id}/cancel` | UC-15 / FR-23 | SRS.md §6.8, §8.3 UC-15, §9 FR-23, §10 BRULE-15/16, §16.2; microservice_design.md §5.6.2, §6.8 |
| trip | POST | `/trips/{id}/reviews` | UC-16 / FR-24 | SRS.md §6.9.3, §8.3 UC-16, §9 FR-24, §10 BRULE-17, §16.2; microservice_design.md §5.6.2, §6.10 |
| trip | GET | `/trips/{id}/review` | UC-16 / FR-25 | SRS.md §9 FR-25, §16.2, §16.2.1; microservice_design.md §5.6.2 |
| trip | POST | `/internal/trips` | [internal INT-06] UC-13 / FR-19, FR-21 | SRS.md §6.6, §14.1 INT-06; microservice_design.md §2.4 INT-06, §5.6.3, §6.6, §9.6.2 |
| trip | GET | `/internal/customers/{id}/active-trip` | [internal INT-07] UC-11 / FR-15 | SRS.md §14.1 INT-07; microservice_design.md §2.4 INT-07, §5.6.3, §9.6.2 |
| trip | GET | `/internal/trips/{id}/payable` | [internal INT-09] UC-17 / FR-26 | SRS.md §6.9.1, §14.1 INT-09; microservice_design.md §2.4 INT-09, §5.6.3, §6.9 |
| trip | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| trip | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| payment | POST | `/payments` | UC-17 / FR-26 | SRS.md §6.9.1, §8.3 UC-17, §9 FR-26, §10 BRULE-18/19/21, §16.2, §16.2.1; microservice_design.md §5.7.2, §6.9, §9.6.4 |
| payment | GET | `/payments/{id}` | UC-17 / FR-27 | SRS.md §8.3 UC-17, §9 FR-27, §16.2, §16.2.1; microservice_design.md §5.7.2 |
| payment | POST | `/payments/callback` | UC-18 / FR-28 | SRS.md §6.9.2, §8.3 UC-18, §9 FR-28, §10 BRULE-20, §16.0 SEC-09, §16.2, §16.2.1; microservice_design.md §2.6.3, §5.7.2, §6.9, §9.6.4 |
| payment | POST | `/payments/{id}/sandbox-confirm` | UC-17, UC-18 / FR-29 | SRS.md §8.3 UC-17, §9 FR-29, §16.2, §17 PC30; microservice_design.md §5.7.2, §10.4 |
| payment | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| payment | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |
| notification | GET | `/notifications` | UC-19 / FR-30 | SRS.md §6.9.4, §8.3 UC-19, §9 FR-30, §12.3, §16.2, §16.2.1; microservice_design.md §5.8.2, §6.11 |
| notification | PATCH | `/notifications/{id}/read` | UC-19 / FR-30 | SRS.md §8.3 UC-19, §9 FR-30, §16.2; microservice_design.md §5.8.2 |
| notification | GET | `/health` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §16.0 NFR-01, §16.2.1; microservice_design.md §5.x.3, §9.5 |
| notification | GET | `/ready` | [health] UC-01 / FR-01 / NFR-01 | SRS.md §8.3 UC-01, §16.0 NFR-01, §16.2.1; microservice_design.md §9.5 |

## Gateway (không có YAML)

| **Service** | **Method** | **Endpoint** | **Use Case / Requirement** | **Source** |
| --- | --- | --- | --- | --- |
| gateway | GET | `/health` | UC-01 / FR-01 | SRS §16.2 'Endpoint chuẩn'; micro §9.4.1 |
| gateway | GET | `/ready` | UC-01 / FR-01 | SRS §16.2; micro §9.4.1 |
| gateway | GET | `/health/services` | UC-01 / FR-01 | SRS §16.2, §16.2.1; micro §9.4.1, §9.5 |

## Kafka events

| **Event** | **Topic** | **Producer** | **Consumer** | **Partition key** | **Source** |
| --- | --- | --- | --- | --- | --- |
| `driver.application.decided` | `driver.events` | driver-service | identity-service, notification-service | driverId | SRS §12.1; micro §7.1 |
| `driver.location.updated` | `driver.events` | driver-service | trip-service | driverId | SRS §12.1; micro §7.1 |
| `booking.offer.created` | `booking.events` | booking-service | notification-service | bookingId | SRS §12.1; micro §7.1 |
| `booking.assigned` | `booking.events` | booking-service | driver-service, notification-service | bookingId | SRS §12.1; micro §7.1 |
| `booking.canceled` | `booking.events` | booking-service | driver-service, notification-service | bookingId | SRS §12.1; micro §7.1 |
| `booking.no_driver_found` | `booking.events` | booking-service | notification-service | bookingId | SRS §12.1; micro §7.1 |
| `trip.assigned` | `trip.events` | trip-service | booking-service, driver-service, notification-service | tripId | SRS §12.1; micro §7.1 |
| `trip.status.changed` | `trip.events` | trip-service | notification-service | tripId | SRS §12.1; micro §7.1 |
| `trip.completed` | `trip.events` | trip-service | booking-service, driver-service, notification-service | tripId | SRS §12.1; micro §7.1 |
| `trip.canceled` | `trip.events` | trip-service | booking-service, driver-service, notification-service | tripId | SRS §12.1; micro §7.1 |
| `trip.review.created` | `trip.events` | trip-service | driver-service | driverId | SRS §12.1; micro §7.1 |
| `payment.completed` | `payment.events` | payment-service | trip-service, notification-service | tripId | SRS §12.1; micro §7.1 |
| `payment.failed` | `payment.events` | payment-service | notification-service | tripId | SRS §12.1; micro §7.1 |

## Requirement coverage

| **FR / UC** | **Phạm vi** | **API** |
| --- | --- | --- |
| FR-01 / UC-01 | P1 | gateway `/health`,`/ready`,`/health/services` + `/health`,`/ready` mỗi service |
| FR-02 / UC-02 | P1 | `POST /auth/register`; INT-01 |
| FR-03 / UC-03 | P1 | `POST /auth/login` |
| FR-04 / UC-04 | P1 | `GET /customers/{id}` |
| FR-05 / UC-05 | P1 | `GET /drivers/{id}` |
| FR-06,07,08 / UC-06 | P1 | `POST /drivers/otp/request`, `/otp/verify`, `/drivers/register`, `GET /drivers/me/application`; INT-02 |
| FR-09,10 / UC-07 | P1 | `GET /admin/drivers`, `GET /admin/drivers/{id}`, `POST approve|reject`; event `driver.application.decided` |
| FR-11,12 / UC-08 | P1 | `PUT /drivers/me/availability`, `PUT /drivers/me/location`; event `driver.location.updated` |
| FR-13 / UC-09 | P1 | `GET /drivers/nearby`; INT-03 |
| FR-14 / UC-10 | P1 | `POST /fare-estimates` |
| FR-15,16,17 / UC-11,12 | P1 | `POST /bookings`, `GET /bookings`, `GET /bookings/{id}`; INT-03..07 |
| FR-18,19 / UC-13 | P1 | `GET /offers`, `GET /offers/{id}`, `POST /offers/{id}/accept|reject`; INT-04,06,08 |
| FR-20,21 / UC-13,14 | P1 | `GET /trips/{id}`, `PATCH /trips/{id}/status` |
| FR-22,23 / UC-15 | P1 | `POST /bookings/{id}/cancel`, `POST /trips/{id}/cancel` |
| FR-24,25 / UC-16 | P1 | `POST /trips/{id}/reviews`, `GET /trips/{id}/review` |
| FR-26,27,29 / UC-17 | P1 | `POST /payments`, `GET /payments/{id}`, `POST /payments/{id}/sandbox-confirm`; INT-09 |
| FR-28 / UC-18 | P1 | `POST /payments/callback` |
| FR-30 / UC-19 | P1 | `GET /notifications`, `PATCH /notifications/{id}/read`; Kafka consume |
| FR-31,32,E14 / UC-20,21 | P2 | **Không có API** — C09 (không tạo route khi chưa có contract chuẩn) |