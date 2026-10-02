# docs/openapi — API contract (OpenAPI 3.0.3)

Nguồn duy nhất: `SRS.md` (v3.6) và `microservice_design.md` (v3.7). **1 service = 1 YAML.** Đây là contract để implement; chưa có code nào được viết ở bước này.

Mỗi operation có `x-source` (trỏ mục SRS/micro), `x-api-type` (`public` | `internal` | `health`), `x-roles`, `x-grpc-rpc` (RPC Gateway dùng, micro §2.6.3) và `x-todo` khi tài liệu chưa đủ căn cứ. Mỗi file có `x-kafka-events` (event produce/consume — **không** biến thành HTTP endpoint) và `x-outgoing-internal-calls` (service này gọi service nào).

## Bảng tổng hợp

| **Service** | **YAML** | **Responsibility** | **Public API** | **Internal API** |
| --- | --- | --- | --- | --- |
| identity-service | [identity-service.yaml](identity-service.yaml) | Account, Authentication, RBAC; hash password; ký JWT RS256; kích hoạt Account Driver từ event. | `POST /auth/register`<br>`POST /auth/login` | Cung cấp: <br>`INT-02 POST /internal/accounts/drivers`<br>Gọi đi: INT-01 |
| customer-service | [customer-service.yaml](customer-service.yaml) | Customer profile (tách riêng khỏi Driver). | `GET /customers/{id}` | Cung cấp: <br>`INT-01 POST /internal/customers` |
| driver-service | [driver-service.yaml](driver-service.yaml) | Driver, Vehicle, OTP, duyệt hồ sơ, availability, location, nearby, reservation. | `GET /drivers/{id}`<br>`POST /drivers/otp/request`<br>`POST /drivers/otp/verify`<br>`POST /drivers/register`<br>`GET /drivers/me/application`<br>`GET /admin/drivers`<br>`GET /admin/drivers/{id}`<br>`POST /admin/drivers/{id}/approve`<br>`POST /admin/drivers/{id}/reject`<br>`PUT /drivers/me/availability`<br>`PUT /drivers/me/location`<br>`GET /drivers/nearby` | Cung cấp: <br>`INT-03 GET /internal/drivers/nearby`<br>`INT-04 POST /internal/drivers/{id}/reservations`<br>`INT-05 DELETE /internal/drivers/{id}/reservations/{reservationId}`<br>`INT-08 POST /internal/drivers/{id}/reservations/{reservationId}/confirm`<br>Gọi đi: INT-02 |
| booking-service | [booking-service.yaml](booking-service.yaml) | Fare estimate, Booking, Offer, Assignment/Dispatch. | `POST /fare-estimates`<br>`POST /bookings`<br>`GET /bookings`<br>`GET /bookings/{id}`<br>`POST /bookings/{id}/cancel`<br>`GET /offers`<br>`GET /offers/{id}`<br>`POST /offers/{id}/accept`<br>`POST /offers/{id}/reject` | Không cung cấp endpoint nghiệp vụ nội bộ<br>Gọi đi: INT-03, INT-04, INT-05, INT-06, INT-07 |
| trip-service | [trip-service.yaml](trip-service.yaml) | Trip, Fare (tính/khóa), Review, price_versions. | `GET /trips/{id}`<br>`PATCH /trips/{id}/status`<br>`POST /trips/{id}/cancel`<br>`POST /trips/{id}/reviews`<br>`GET /trips/{id}/review` | Cung cấp: <br>`INT-06 POST /internal/trips`<br>`INT-07 GET /internal/customers/{id}/active-trip`<br>`INT-09 GET /internal/trips/{id}/payable`<br>Gọi đi: INT-08 |
| payment-service | [payment-service.yaml](payment-service.yaml) | Payment, callback Provider, idempotency thanh toán. | `POST /payments`<br>`GET /payments/{id}`<br>`POST /payments/callback`<br>`POST /payments/{id}/sandbox-confirm` | Không cung cấp endpoint nghiệp vụ nội bộ<br>Gọi đi: INT-09 |
| notification-service | [notification-service.yaml](notification-service.yaml) | Inbox thông báo; consume Kafka. | `GET /notifications`<br>`PATCH /notifications/{id}/read` | Không cung cấp endpoint nghiệp vụ nội bộ |

Mỗi service còn có `GET /health` và `GET /ready` (kind `health`, cần `X-Service-Token`) theo NFR-01/micro §9.5.

## Số lượng

| Service | Public | Internal | Health | Tổng |
| --- | ---: | ---: | ---: | ---: |
| identity-service | 2 | 1 | 2 | 5 |
| customer-service | 1 | 1 | 2 | 4 |
| driver-service | 12 | 4 | 2 | 18 |
| booking-service | 9 | 0 | 2 | 11 |
| trip-service | 5 | 3 | 2 | 10 |
| payment-service | 4 | 0 | 2 | 6 |
| notification-service | 2 | 0 | 2 | 4 |
| **Tổng** | **35** | **9** | **14** | **58** |

35 public route khớp 35 RPC ở micro §2.6.3; 9 internal = INT-01..INT-09. 3 route public còn lại của SRS §16.2 (`GET /health`, `/ready`, `/health/services`) thuộc **gateway** — không thuộc 7 service nên không có YAML (xem `api-traceability.md`).

## Kafka / event contract

Kafka **không** được mô tả thành REST. Hợp đồng nằm trong `x-kafka-events` của từng YAML (topic, partition key, producer, consumer, consumer group, payload schema, envelope `EventEnvelope`).

| Service | Produce | Consume |
| --- | --- | --- |
| identity-service | — | `driver.application.decided` |
| customer-service | — | — |
| driver-service | `driver.application.decided`<br>`driver.location.updated` | `booking.assigned`<br>`booking.canceled`<br>`trip.assigned`<br>`trip.completed`<br>`trip.canceled`<br>`trip.review.created` |
| booking-service | `booking.offer.created`<br>`booking.assigned`<br>`booking.canceled`<br>`booking.no_driver_found` | `trip.assigned`<br>`trip.completed`<br>`trip.canceled` |
| trip-service | `trip.assigned`<br>`trip.status.changed`<br>`trip.completed`<br>`trip.canceled`<br>`trip.review.created` | `driver.location.updated`<br>`payment.completed` |
| payment-service | `payment.completed`<br>`payment.failed` | — |
| notification-service | — | `driver.application.decided`<br>`booking.offer.created`<br>`booking.assigned`<br>`booking.canceled`<br>`booking.no_driver_found`<br>`trip.assigned`<br>`trip.status.changed`<br>`trip.completed`<br>`trip.canceled`<br>`payment.completed`<br>`payment.failed` |

13 event, 4 topic nghiệp vụ (`driver.events`, `booking.events`, `trip.events`, `payment.events`) + `cab.dead-letter` (DLQ). Customer-service không produce/consume event P1.

## Quyết định thiết kế contract (và lý do)

- **Server URL**: mỗi YAML có 2 server — Gateway `http://localhost:8000` (theo docx §12) và service trực tiếp (identity 3000, customer 3001, driver 3002, booking 3003, trip 3004, payment 3005, notification 3006). Port là biến `{port}` trong server, không hard-code vào business logic.
- **Public vs internal**: `/internal/**` có `servers` riêng trỏ thẳng service và `security: serviceToken`; Gateway trả 404 cho client (SRS §14.1).
- **Security**: `bearerAuth` (JWT RS256) chỉ gắn endpoint cần; `PUBLIC` = `security: []`; callback dùng `providerSignature` (HMAC); register Driver dùng `registrationToken`.
- **Idempotency-Key**: bắt buộc đúng danh sách SRS §16.2.1; **không** gắn cho `PUT /drivers/me/location`, `PUT /drivers/me/availability`, `PATCH /trips/{id}/status`.
- **Status code**: chỉ liệt kê mã có căn cứ (SRS §16.2 bảng mã HTTP + UC). 429 chỉ ghi ở endpoint có rate riêng (login, OTP, booking, location, payment); rate chung ghi ở `info.description`.
- **Tọa độ ngoài SERVICE_AREA** trả 422 nên schema `Coordinate` không đặt min/max (tránh Swagger/validator sinh 400).

## Điểm lệch giữa các nguồn và cách chuẩn hóa

- **Port local (ĐÃ CHỐT)** — Gateway 8000; identity 3000, customer 3001, driver 3002, booking 3003, trip 3004, payment 3005, notification 3006 (theo docx §12 / implementation hiện tại). Giá trị 8080 và 3001–3007 trong SRS §16.1 / micro §2.4, §10.2 được coi là lỗi thời; mọi YAML đã dùng port đã chốt. Khi sửa SRS/micro, đổi theo bảng này.
- **Kiểu `fare` ở INT-09 (ĐÃ CHỐT)** — Dùng object `{amountVnd,currency,tariffVersion}` thống nhất với DTO Trip/Fare; con số `fare: 50000` ở sơ đồ micro §6.9 chỉ là minh họa.
- **Tên field estimate (ĐÃ CHỐT)** — Dùng camelCase `estimatedFareVnd` theo quy ước JSON micro §1.3 thay cho `estimated_fare` ở micro §6.5.
- **Gateway → service là gRPC (CÒN MỞ)** — micro v3.7 §2.6 ghi Gateway gọi service bằng gRPC (cổng 50051), SRS §14.1/§16.1 chưa cập nhật, backend chưa đối chiếu (C01). YAML mô tả REST contract + `x-grpc-rpc`; cần xác nhận service có expose REST trực tiếp trên các port 3000–3006 hay không.

## ❓ API/event chưa đủ thông tin để xác định (không tự đoán)

- **Đồng bộ tariff Trip → Booking** (`price_versions` → `tariff_snapshots`, 'đồng bộ idempotent theo snapshot_version'): tài liệu không nói bằng REST, Kafka hay seed. **Không có endpoint/event nào được tạo.** Cần chốt cơ chế (SRS §13.2, micro §5.5.6/§9.6.6 G03).
- **INT-06 `POST /internal/trips`**: danh sách field chỉ có bookingId, offerId, reservationId, customerId, driverId, pickup, dropoff, vehicleType + 'snapshot'. Thiếu nguồn của **reservation token** và **distance_m** (cần cho INT-08 confirm và tính Fare), vị trí truyền `commandKey`, nội dung `snapshot`.
- **INT-07 response**: chỉ ghi 'Xác nhận không có Trip hoạt động'; chưa nói có Trip → body gì, không có → 404 hay 200 rỗng.
- **INT-05 release CONFIRMED**: cần binding commandKey/tripId/ABORTED nhưng DELETE chưa có body/params.
- **INT-02 / INT-01 replay**: status code khi replay hợp lệ; field chính xác body INT-02 (đang suy từ §6.2/§16.2.1: registrationToken, driverId, password, email?).
- **INT-03**: query params và schema item chưa định nghĩa (đang tái dùng `NearbyDriver`).
- **INT-04**: mã lỗi khi Driver không đủ điều kiện reserve (đang dùng 409).
- **`registrationToken` đặt ở đâu** (Authorization header hay body) khi gọi `POST /drivers/register`.
- **`scope`** trong login response: string hay array; danh sách scope theo role ACTIVE (chỉ biết scope của Driver hạn chế: `driver.application.read`, `notifications.read`). **`expiresIn`**: đơn vị.
- **Response body chưa được định nghĩa**: `PUT /drivers/me/availability`, `PUT /drivers/me/location`, `PATCH /trips/{id}/status`, `POST /trips/{id}/cancel`, cancel Booking, reject Offer, `sandbox-confirm`, `PATCH /notifications/{id}/read`, `POST /drivers/register` (tên field ID), DTO `DriverApplication`/`AdminDriverDetail` (format mask), DTO `Review`, `Notification.resource`, response `POST /fare-estimates` (tên field distance/ETA).
- **Mã lỗi chưa quy định**: phone đã dùng khi request OTP; `sandbox-confirm` khi SANDBOX_MODE=false; Admin chọn customer khi `GET /bookings`; giá trị mặc định/tập giá trị `status` của `GET /admin/drivers`.
- **`ErrorResponse.code`**: chỉ có 4 mã tài liệu nêu (MISSING_IDEMPOTENCY_KEY, ACTIVE_OFFER_EXISTS, TRIP_ALREADY_CREATED, TARIFF_NOT_CONFIGURED) → không đặt enum. Vị trí `cancelEndpoint` trong body 409.
- **Body `/health` và `/ready`** từng service không có schema; chỉ `/health/services` của Gateway có `{services:[{name,status,dependencies}],checkedAt}`.
- **`canceledBy`** trong `trip.canceled`: tập giá trị không được liệt kê (SRS §7 chỉ nói lưu canceledBy).
- **P2** (`backoffice-service`, Audit Log, Incident, báo cáo, refresh/logout, quản lý account/role, `payment_methods`, `customer_activity`; UC-20/21; FR-31/32; FR-E14): **không có API** — SRS ghi 'chưa có API chuẩn thì không tạo route mới' (C09).

Các chỗ này đều có `x-todo` tại đúng operation/schema trong YAML (tìm `Chưa xác định trong SRS/microservice_design`).

## Gateway (ngoài 7 YAML)

`GET /health`, `GET /ready`, `GET /health/services` (UC-01/FR-01, PUBLIC) thuộc gateway — theo docx §1 chỉ có 7 file YAML nên không tạo `gateway.yaml`. `/health/services` trả `{services:[{name,status,dependencies}],checkedAt}`, 503 khi thành phần DOWN (SRS §16.2.1). Nếu cần Swagger cho Gateway, hãy yêu cầu thêm riêng.

## Validate

Mỗi file được kiểm bằng 2 validator độc lập: `openapi-spec-validator` (Python) và `@apidevtools/swagger-cli validate` (Swagger Parser): cú pháp YAML, schema hợp lệ, không `$ref` hỏng, không schema undefined, không trùng `operationId`/path+method.

| YAML | Kết quả |
| --- | --- |
| identity-service.yaml | ✅ valid |
| customer-service.yaml | ✅ valid |
| driver-service.yaml | ✅ valid |
| booking-service.yaml | ✅ valid |
| trip-service.yaml | ✅ valid |
| payment-service.yaml | ✅ valid |
| notification-service.yaml | ✅ valid |

Chưa chạy trực tiếp trên Swagger UI/Editor trong môi trường này; các điểm Swagger không thể tự thực hiện: tính HMAC cho `/payments/callback` (dùng `sandbox-confirm`), nhập Bearer token (có sẵn nút Authorize cho `bearerAuth`).
