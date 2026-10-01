# CAB System — DDD Bounded Context → Microservice

## 0. Mục tiêu, phạm vi và nguồn

Tài liệu chuyển baseline CAB System thành kiến trúc triển khai microservice cho đồ án 7 tuần. Nguồn chuẩn là SRS §3, §7–§12; `api_document/_manifest.yaml`; và 30 tiêu chí trong `phieucham.md`. Khi phiếu chấm dùng thuật ngữ khác SRS, tài liệu giữ tên SRS trong code/data và chỉ ghi alias ở Phần VII.

Quy tắc chốt: một Bounded Context (BC) bằng một microservice và một database riêng; API Gateway và RabbitMQ là hạ tầng, không phải BC. Toàn hệ thống chỉ dùng PostgreSQL cho dữ liệu; mỗi BC có database và user riêng trên cùng một server PostgreSQL. Mỗi mã ENT, FR, UC, DEC và API có một chủ sở hữu duy nhất trong ma trận Phần III.

Các endpoint không có trong SRS §12.1 được đánh mã `API-Xnn` và gắn `⚠ Giả định (bổ sung theo phiếu chấm)`. Chúng không làm thay đổi 30 API baseline cho đến khi SRS được cập nhật.

## Phần I. Bước 1 — Xác định Bounded Context toàn hệ thống

### I.1. Danh sách BC và quyết định phân rã

| BC | Trách nhiệm, actor chính | Kiểm tra khả năng phân rã | Kết luận |
| --- | --- | --- | --- |
| BC-01 Identity & Driver | Tài khoản, JWT/refresh, hồ sơ khách/tài xế, duyệt hồ sơ, Vehicle, Availability, DriverLocation. Actor: CUSTOMER, DRIVER, ADMIN, OPERATOR. | Identity và Driver Operations có ngôn ngữ/tải khác nhau, đặc biệt vị trí cập nhật 12 lần/phút. Tuy nhiên User–DriverApplication–Vehicle–Availability cùng quyết định tài xế có được ONLINE; tách thêm tạo saga kích hoạt phức tạp trong 7 tuần. | Có thể phân rã sau pilot; hiện giữ một BC đúng DEC-14. |
| BC-02 Ride | RideRequest, matching, RideOffer, Trip, StatusHistory, Rating. Actor: CUSTOMER, DRIVER. | Matching có timer/tải riêng, Trip có state machine riêng; nhưng ACCEPT phải nguyên tử với RideRequest/Offer/Trip theo DEC-04. Tách sẽ làm invariant cạnh tranh thành giao dịch phân tán. | Không nên phân rã trong pilot. |
| BC-03 Billing | PriceVersion, Fare, Payment, PaymentAttempt và mock provider. Actor: CUSTOMER, DRIVER, OPERATOR, Mock Provider. | Pricing và Payment có thể phát triển độc lập, nhưng PriceVersion được giữ khi đặt và Payment chỉ mở sau Fare FINALIZED; tải pilot thấp. | Có thể phân rã sau pilot; giữ chung để giảm vận hành. |
| BC-04 Notification | Inbox, consumer dedupe, retry/DLQ và SSE. Actor: CUSTOMER, DRIVER. | Inbox và SSE cùng dùng một bản ghi Notification làm nguồn theo DEC-10/37; tách không tạo invariant độc lập có giá trị. | Không nên phân rã. |
| BC-05 Operations & Reporting | Incident, AuditLog, projection báo cáo, giám sát vận hành. Actor: OPERATOR, ADMIN, EXECUTIVE. | Incident là write model; reporting là read model và có thể tách khi tải phân tích tăng. Pilot dùng cùng event stream và đội vận hành, tách thêm một service không đem lại lợi ích đủ lớn. | Có thể phân rã sau pilot; hiện giữ chung đúng DEC-14. |

Chốt **5 BC = 5 microservice** vì đây chính là service boundary đã duyệt ở SRS §4/DEC-14, bao phủ 30 API mà không tạo giao dịch phân tán mới. API Gateway không được tính là BC thứ sáu.

### I.2. Context Map

```mermaid
flowchart LR
  ID[BC-01 Identity & Driver]
  R[BC-02 Ride]
  B[BC-03 Billing]
  N[BC-04 Notification]
  O[BC-05 Operations & Reporting]

  ID -->|candidate/snapshot REST, DriverLocationUpdated| R
  R -->|RideAssigned, TripStatusChanged, RatingCreated| ID
  R -->|TripCompleted, Fare query ACL| B
  R -->|Ride/Offer/Trip events| N
  B -->|FareFinalized, PaymentStatusChanged| N
  ID -->|DriverApplicationDecided| N
  ID -->|AuditRecorded| O
  R -->|trip, offer outcome, no-driver, audit events| O
  B -->|AuditRecorded, payment projection| O
  O -->|idempotent incident command REST| R
  O -->|idempotent fare review REST| B
  O -->|IncidentResolved| N
```

Identity & Driver cung cấp Open Host Service cho xác thực và điều kiện tài xế. Ride là customer của dữ liệu vị trí nhưng không đọc database Identity. Billing là downstream conformist với `TripCompleted`. Notification và Operations dùng Published Language qua RabbitMQ; Operations dùng Anti-Corruption Layer khi phát lệnh kết thúc Trip hoặc review Fare.

### I.3. Quy tắc tích hợp

- REST đồng bộ chỉ dùng khi request hiện tại cần kết quả ngay; timeout 800 ms, tối đa một retry có jitter cho GET idempotent, circuit breaker mở sau 5 lỗi/10 giây và thử lại sau 30 giây.
- Thay đổi nghiệp vụ phát event bằng transactional outbox; consumer dedupe theo `eventId`, xử lý at-least-once và không ghi chéo database.
- Mọi message có `eventId`, `eventType`, `aggregateId`, `version`, `occurredAt`, `correlationId`, `payload`.
- Nhất quán mạnh chỉ nằm trong một service. Notification/reporting nhất quán cuối cùng; API của owner là nguồn xác nhận trạng thái.

### I.4. Quyết định CSDL chung

Chọn duy nhất **PostgreSQL 16**. Trong 28 entity của SRS có nhiều quan hệ và invariant chặt: User–Profile–Vehicle–Availability, RideRequest–RideOffer–Trip–Rating, Fare–Payment–PaymentAttempt và Incident–Audit. DEC-04/28/34 yêu cầu cạnh tranh ACCEPT, một Payment/Trip, version và idempotency; các ràng buộc này cần transaction ACID, `UNIQUE`, `CHECK`, khóa hàng và optimistic locking. PostgreSQL đáp ứng trực tiếp mà không thêm cơ chế đồng bộ giữa nhiều engine.

Phương án này phù hợp đồ án sinh viên 7 tuần: một công nghệ miễn phí, một image Docker, SQL quen thuộc, migration/seed/test/backup thống nhất và dễ chứng minh parameter binding, quyền user database, encryption at rest. Không chọn MongoDB vì schema hiện đã rõ và phần linh hoạt có thể lưu bằng `jsonb`; không chọn Redis vì dữ liệu TTL/timer của pilot có thể lưu bền vững hoặc giữ trong bộ nhớ tiến trình. Không trộn nhiều loại vì chi phí học, vận hành, backup và xử lý lỗi lớn hơn lợi ích ở tải pilot.

| Nhu cầu đặc thù | Cách xử lý bằng PostgreSQL/ứng dụng | Đánh đổi pilot |
| --- | --- | --- |
| Idempotency 24 giờ, DEC-34 | Mỗi service có `idempotency_records`, `UNIQUE(subject_id,key)`, payload hash, state, response, expiresAt; job dọn định kỳ. | Insert thắng được chạy; insert thua trả response cũ hoặc 409 khi IN_PROGRESS/khác payload. |
| Rate limit, DEC-30 | Gateway một instance giữ cửa sổ IP/user trong bộ nhớ. | Mất bộ đếm khi Gateway restart; chấp nhận ở pilot, không dùng cho triển khai nhiều replica. |
| Offer 20 giây/hard stop 180 giây | `ride_offers.expires_at`, `ride_requests.search_started_at`; scheduler mỗi giây dùng `FOR UPDATE SKIP LOCKED`. | Quét định kỳ tạo sai số tối đa khoảng một giây nhưng trạng thái phục hồi sau restart. |
| Vị trí nóng/GEO | `driver_current_locations` upsert; lọc bounding box rồi Haversine trong SQL; index `(lat,lng)`. | Không tối ưu như spatial engine ở quy mô lớn nhưng đủ tối đa 100 Trip đồng thời. |
| OTP tài xế | `otp_challenges` chứa hash, attempts, expiresAt, verifiedAt; job dọn. | `⚠ Giả định`: SRS chưa chốt OTP. |
| Khóa đăng nhập sai | Dùng `login_attempts` ENT-26 và query cửa sổ 15 phút. | Thêm query DB cho mỗi login. |
| Callback trùng/khóa Payment | `provider_events.provider_event_id UNIQUE`; khóa hàng Payment bằng `SELECT FOR UPDATE`. | Transaction giữ khóa ngắn trong callback. |
| SSE và Last-Event-ID | Connection registry trong bộ nhớ; Last-Event-ID là cursor `(createdAt,id)` đọc từ `notifications`. | Kết nối mất khi restart và client reconnect theo DEC-10/37. |

Ngoài tải pilot 100 Trip đồng thời hoặc khi Gateway/service cần nhiều replica, có thể đánh giá cache/GEO/rate-limit phân tán hay engine chuyên dụng; đây là ngoài phạm vi đồ án. Triển khai dùng một server `postgres:16`, năm database `cab_identity_db`, `cab_ride_db`, `cab_billing_db`, `cab_notification_db`, `cab_operations_db`; mỗi database có user riêng, không FK/join/transaction chéo database.

## Phần II-A. Bước 0 — Kiến trúc hệ thống và hạ tầng

### 0.1. Cấu trúc source code — Phiếu #1

```text
cab-system/
├── gateway/                         # API Gateway, auth ở biên, routing, rate limit, health aggregation
├── services/
│   ├── identity-driver-service/     # BC-01, migration và test riêng
│   ├── ride-service/                # BC-02
│   ├── billing-service/             # BC-03
│   ├── notification-service/        # BC-04
│   └── operations-reporting-service/# BC-05
├── contracts/                       # JSON Schema/AsyncAPI event và DTO versioned; không chứa logic
├── infra/                           # compose, RabbitMQ definitions, observability, scripts seed/backup
├── api_document/                    # OpenAPI 3.0.3 và manifest 30 API
├── postman/                         # collection, environment, smoke test #6–#30
├── tests/                           # contract và end-to-end test xuyên service
├── .env.example                     # tên biến, chỉ có giá trị giả
└── docker-compose.yml
```

Mỗi service tự chứa `src/api`, `src/application`, `src/domain`, `src/infrastructure`, `migrations`, `tests/unit`, `tests/integration`, `Dockerfile`. Phụ thuộc chỉ đi `api → application → domain`; `infrastructure` triển khai interface do application/domain định nghĩa. Domain không import framework, ORM hoặc broker. Tên service/kebab-case, package/snake_case, class/PascalCase, field giữ nguyên camelCase của SRS tại biên API và ánh xạ rõ sang snake_case ở persistence.

### 0.2. `.gitignore` và `.env` — Phiếu #2

`.gitignore` tối thiểu:

```gitignore
.env
.env.*
!.env.example
node_modules/
dist/
build/
coverage/
*.log
*.pem
*.key
*.crt
.secrets/
data/
volumes/
```

`.env.example` dùng giá trị giả:

| Biến | Ví dụ giả | Service dùng |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `change-postgres-admin-password` | Container PostgreSQL/bootstrap |
| `IDENTITY_DB_PASSWORD`, `RIDE_DB_PASSWORD` | `change-identity-db-password`, `change-ride-db-password` | Compose tạo role và dựng DB URL cho Identity/Ride |
| `BILLING_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD`, `OPERATIONS_DB_PASSWORD` | `change-billing-db-password`, `change-notification-db-password`, `change-operations-db-password` | Compose tạo role và dựng DB URL cho ba service |
| `RABBITMQ_PASSWORD` | `change-rabbitmq-password` | Compose dựng `RABBITMQ_URL` cho mọi service |
| `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` | `/run/secrets/jwt_private.pem`, `/run/secrets/jwt_public.pem` | Identity ký; Gateway/service kiểm chữ ký |
| `FIELD_ENCRYPTION_KEY`, `FIELD_KEY_VERSION` | `base64-demo-not-a-real-key`, `v1` | Identity, Ride và Operations; pilot dùng chung khóa, production nên tách khóa/service |
| `PAYMENT_CALLBACK_SECRET` | `demo-rotate-before-use` | Billing mock adapter |
| `INTERNAL_SERVICE_TOKEN` | `demo-internal-token` | REST nội bộ trong pilot |
| `APP_ENV`, `OTP_DELIVERY_MODE`, `TEST_OTP_CODE` | `local`, `fixed`, `123456` | Chỉ Identity local/test; production cấm mode fixed |

`*_DB_URL` và `RABBITMQ_URL` là biến runtime do Compose dựng từ các password trên, không phải biến đầu vào bị khai báo trùng trong `.env.example`. Hai file PEM nằm ở `infra/secrets/` cục bộ (đã bị `.gitignore` loại trừ) và được mount read-only. CI phải kiểm tra `.env` không được Git track, `.env.example` có mặt, secret scan không báo khóa thật. Nếu secret từng bị commit: thu hồi/xoay khóa ngay, cập nhật secret store, xóa khỏi lịch sử bằng `git filter-repo`, force-push có phối hợp và buộc đăng nhập lại; chỉ xóa file ở commit mới là chưa đủ.

### 0.3. API Gateway — Phiếu #3 và #8

| Trách nhiệm | Cách thực hiện |
| --- | --- |
| Routing | Route `/api/v1` theo bảng dưới; không chứa business logic. |
| JWT | Kiểm chữ ký bất đối xứng, `exp`, `iss`, `aud`; gắn `sub`, `role` đã xác thực vào header nội bộ có ký. |
| Phân quyền thô | Chặn role không thuộc allow-list; service vẫn kiểm ownership và rule. |
| Rate limit | Gateway một instance đếm cửa sổ IP/user trong bộ nhớ theo DEC-30; trả 429 và `Retry-After`. |
| Correlation | Nhận hoặc sinh UUID `X-Correlation-Id`, truyền qua REST/message/log. |
| Biên HTTP | Body tối đa 1 MiB, JSON UTF-8, CORS allow-list ba web app, TLS ≥1.2. |
| SSE proxy | API-26 truyền streaming, không buffer/compress; heartbeat 15 giây, idle/read timeout tối đa 65 phút; đóng stream không muộn hơn `exp` của access JWT; giữ `Last-Event-ID`. |
| Health facade | Thực thi `/health`, `/ready`, gom `/health/services` song song. |

| Method | Path pattern | Service | Auth/role |
| --- | --- | --- | --- |
| GET | `/health` (API-X01) | Gateway | Public |
| GET | `/ready` (API-X02) | Gateway | Public |
| GET | `/health/services` (API-X03) | Gateway | Public |
| POST | `/api/v1/auth/register` (API-01) | Identity & Driver | Public |
| POST | `/api/v1/auth/driver-registrations` (API-02) | Identity & Driver | Public + OTP verification |
| POST | `/api/v1/auth/login` (API-03) | Identity & Driver | Public |
| POST | `/api/v1/auth/refresh` (API-04) | Identity & Driver | Public; xác thực bằng refresh token trong body |
| PATCH | `/api/v1/me/profile` (API-05) | Identity & Driver | CUSTOMER/DRIVER |
| PUT | `/api/v1/drivers/me/availability` (API-06) | Identity & Driver | DRIVER |
| PUT | `/api/v1/drivers/me/location` (API-07) | Identity & Driver | DRIVER |
| POST | `/api/v1/operations/internal-users` (API-08) | Identity & Driver | ADMIN |
| POST | `/api/v1/operations/accounts/{id}/lock` (API-09) | Identity & Driver | OPERATOR |
| POST | `/api/v1/operations/accounts/{id}/unlock` (API-10) | Identity & Driver | OPERATOR |
| GET | `/api/v1/operations/customers/{id}` (API-X04) | Identity & Driver | OPERATOR |
| GET | `/api/v1/operations/drivers/{id}` (API-X05) | Identity & Driver | OPERATOR |
| GET | `/api/v1/operations/drivers/nearby` (API-X06) | Identity & Driver | OPERATOR |
| POST | `/api/v1/auth/driver-registrations/otp-requests` (API-X08) | Identity & Driver | Public |
| POST | `/api/v1/auth/driver-registrations/otp-verifications` (API-X09) | Identity & Driver | Public |
| GET | `/api/v1/operations/driver-applications` (API-X10) | Identity & Driver | OPERATOR |
| GET | `/api/v1/operations/driver-applications/{id}` (API-X11) | Identity & Driver | OPERATOR |
| PATCH | `/api/v1/operations/driver-applications/{id}` (API-X12) | Identity & Driver | OPERATOR |
| POST | `/api/v1/ride-requests` (API-11) | Ride | CUSTOMER |
| POST | `/api/v1/ride-requests/{id}/cancellation` (API-12) | Ride | CUSTOMER |
| POST | `/api/v1/ride-offers/{id}/responses` (API-13) | Ride | DRIVER |
| PUT | `/api/v1/trips/{id}/status` (API-14) | Ride | DRIVER |
| POST | `/api/v1/trips/{id}/cancellation` (API-15) | Ride | CUSTOMER/DRIVER |
| GET | `/api/v1/trips/{id}` (API-16) | Ride | CUSTOMER/DRIVER |
| POST | `/api/v1/trips/{id}/ratings` (API-17) | Ride | CUSTOMER |
| GET | `/api/v1/ride-requests` (API-X07) | Ride | CUSTOMER |
| POST | `/api/v1/fare-estimates` (API-18) | Billing | CUSTOMER |
| GET | `/api/v1/trips/{id}/fare` (API-19) | Billing | CUSTOMER/DRIVER |
| POST | `/api/v1/fares/{id}/reviews` (API-20) | Billing | OPERATOR |
| POST | `/api/v1/trips/{id}/payments` (API-21) | Billing | CUSTOMER |
| POST | `/api/v1/payments/{id}/cash-confirmation` (API-22) | Billing | DRIVER |
| POST | `/api/v1/payments/provider-callbacks` (API-23) | Billing | Mock Provider, HMAC |
| GET | `/api/v1/notifications` (API-24) | Notification | CUSTOMER/DRIVER |
| PATCH | `/api/v1/notifications/{id}` (API-25) | Notification | CUSTOMER/DRIVER |
| GET | `/api/v1/me/events` (API-26) | Notification | CUSTOMER/DRIVER |
| GET | `/api/v1/operations/trips/active` (API-27) | Operations & Reporting | OPERATOR |
| POST | `/api/v1/trips/{id}/incidents` (API-28) | Operations & Reporting | CUSTOMER/DRIVER/OPERATOR |
| PATCH | `/api/v1/operations/incidents/{id}` (API-29) | Operations & Reporting | OPERATOR |
| GET | `/api/v1/reports/operations` (API-30) | Operations & Reporting | OPERATOR/ADMIN/EXECUTIVE |

Chỉ `api-gateway` publish `8080:8080`; service và database chỉ tham gia mạng `cab-internal` với `expose`, không có `ports`. Kiểm chứng: `curl localhost:8081/health` phải không kết nối; `curl localhost:8080/health` trả 200; log Gateway và service có cùng correlation ID.

```mermaid
flowchart LR
  C[Three web clients] -->|TLS :8080| G[API Gateway]
  G -->|JWT + correlationId| S[Owning service]
  S --> D[(Private database)]
  S -->|Outbox event| Q[(RabbitMQ)]
```

### 0.4. IPC giữa microservice — Phiếu #4

| Cặp service | Kiểu | Contract/lý do | Resilience |
| --- | --- | --- | --- |
| Ride → Identity & Driver | REST GET nội bộ | Candidate trả `driverId` và snapshot `fullName`, `plate`, `vehicleTypeCode`, `ratingAverage`; nếu ACCEPT thiếu snapshot thì gọi lại theo driverId. | 800 ms; 1 retry GET; circuit breaker. Candidate query lỗi thì hoãn vòng; snapshot lỗi lúc ACCEPT trả 503 và chưa commit assignment. |
| Ride → Billing | REST POST nội bộ | Fare estimate cần ngay trước khi tạo RideRequest. | 800 ms; không tạo request nếu không có quote; dùng cùng Idempotency-Key khi retry. |
| Operations → Ride | REST command có idempotency | Kết thúc Trip theo Incident resolution. | 1,5 giây; chỉ retry với cùng Idempotency-Key. |
| Operations → Billing | REST command có idempotency | Fare review cần phản hồi ngay cho OPERATOR. | 1,5 giây; chỉ retry với cùng Idempotency-Key. |
| Identity & Driver → Ride | RabbitMQ | `DriverLocationUpdated` để cộng distance khi Trip IN_PROGRESS. | Outbox, queue riêng, dedupe eventId, DLQ. |
| Ride → Identity & Driver | RabbitMQ | `RideAssigned`/`TripStatusChanged` cập nhật projection Availability.ON_TRIP; `RatingCreated` cập nhật rating trung bình. | Eventual consistency, dedupe eventId; không dùng projection để bảo vệ invariant Trip. |
| Ride → Billing | RabbitMQ | `TripCompleted` kích hoạt Fare cuối. | Durable, idempotent theo tripId+version, DLQ. |
| Identity/Ride/Billing/Operations → Notification | RabbitMQ | Thông báo không rollback giao dịch nguồn. | Retry 1/5/25 giây rồi DLQ theo DEC-37. |
| Tất cả → Operations | RabbitMQ | Audit/projection không chặn request nguồn. | Outbox, consumer idempotent, DLQ. |

REST nội bộ dùng service token ngắn hạn trong mạng riêng; production thay bằng mTLS. Không tin role do client gửi. `X-Correlation-Id` được truyền nguyên vẹn vào message.

```mermaid
sequenceDiagram
  participant C as Customer
  participant G as Gateway
  participant R as Ride
  participant I as IdentityDriver
  participant B as Billing
  participant Q as RabbitMQ
  participant N as Notification
  C->>G: POST /ride-requests
  G->>R: JWT + Idempotency-Key
  R->>B: POST internal fare-estimates
  B-->>R: quotedFareVnd + priceVersionId
  R->>R: commit RideRequest + outbox
  R-->>C: 201 SEARCHING
  R->>I: GET internal nearby candidates (sync)
  I-->>R: tối đa 3 driver phù hợp
  R->>R: commit RideOffer expiresAt=+20s
  R->>Q: RideOfferCreated (async)
  Q->>N: deliver event
  N-->>Q: ack sau khi ghi inbox
```

### 0.5. Docker Compose và container — Phiếu #5

| Container | Image/build | Vai trò | Port nội bộ | Publish host | Phụ thuộc/health | Volume |
| --- | --- | --- | --- | --- | --- | --- |
| `api-gateway` | `./gateway` | entry point | 8080 | `8080:8080` | 5 service ready | không |
| `identity-driver-service` | build service | BC-01 | 8081 | — | PostgreSQL, RabbitMQ | không |
| `ride-service` | build service | BC-02 | 8082 | — | PostgreSQL, RabbitMQ | không |
| `billing-service` | build service | BC-03 | 8083 | — | PostgreSQL, RabbitMQ | không |
| `notification-service` | build service | BC-04 | 8084 | — | PostgreSQL, RabbitMQ | không |
| `operations-reporting-service` | build service | BC-05 | 8085 | — | PostgreSQL, RabbitMQ | không |
| `postgres` | `postgres:16` | 5 database, 5 user riêng | 5432 | — | `pg_isready` | `postgres-data`, init script read-only |
| `rabbitmq` | `rabbitmq:3-management` | broker + management nội bộ | 5672/15672 | — | `rabbitmq-diagnostics ping` | `rabbitmq-data` |

Tổng: **8 container** = 1 Gateway + 5 service + 1 PostgreSQL + 1 RabbitMQ.

```yaml
services:
  api-gateway:
    build:
      context: ./gateway
    ports:
      - "8080:8080"
    environment:
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
      IDENTITY_SERVICE_URL: http://identity-driver-service:8081
      RIDE_SERVICE_URL: http://ride-service:8082
      BILLING_SERVICE_URL: http://billing-service:8083
      NOTIFICATION_SERVICE_URL: http://notification-service:8084
      OPERATIONS_SERVICE_URL: http://operations-reporting-service:8085
    volumes:
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    networks:
      - cab-internal
    depends_on:
      identity-driver-service:
        condition: service_healthy
      ride-service:
        condition: service_healthy
      billing-service:
        condition: service_healthy
      notification-service:
        condition: service_healthy
      operations-reporting-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8080/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  identity-driver-service:
    build:
      context: ./services/identity-driver-service
    environment:
      IDENTITY_DB_URL: postgresql://cab_identity:${IDENTITY_DB_PASSWORD}@postgres:5432/cab_identity_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
      JWT_PRIVATE_KEY_PATH: ${JWT_PRIVATE_KEY_PATH}
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      FIELD_ENCRYPTION_KEY: ${FIELD_ENCRYPTION_KEY}
      FIELD_KEY_VERSION: ${FIELD_KEY_VERSION}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
      APP_ENV: ${APP_ENV}
      OTP_DELIVERY_MODE: ${OTP_DELIVERY_MODE}
      TEST_OTP_CODE: ${TEST_OTP_CODE}
    volumes:
      - ./infra/secrets/jwt_private.pem:${JWT_PRIVATE_KEY_PATH}:ro
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    expose:
      - "8081"
    networks:
      - cab-internal
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8081/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  ride-service:
    build:
      context: ./services/ride-service
    environment:
      RIDE_DB_URL: postgresql://cab_ride:${RIDE_DB_PASSWORD}@postgres:5432/cab_ride_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      FIELD_ENCRYPTION_KEY: ${FIELD_ENCRYPTION_KEY}
      FIELD_KEY_VERSION: ${FIELD_KEY_VERSION}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
      IDENTITY_SERVICE_URL: http://identity-driver-service:8081
      BILLING_SERVICE_URL: http://billing-service:8083
    volumes:
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    expose:
      - "8082"
    networks:
      - cab-internal
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8082/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  billing-service:
    build:
      context: ./services/billing-service
    environment:
      BILLING_DB_URL: postgresql://cab_billing:${BILLING_DB_PASSWORD}@postgres:5432/cab_billing_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      PAYMENT_CALLBACK_SECRET: ${PAYMENT_CALLBACK_SECRET}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
    volumes:
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    expose:
      - "8083"
    networks:
      - cab-internal
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8083/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  notification-service:
    build:
      context: ./services/notification-service
    environment:
      NOTIFICATION_DB_URL: postgresql://cab_notification:${NOTIFICATION_DB_PASSWORD}@postgres:5432/cab_notification_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
    volumes:
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    expose:
      - "8084"
    networks:
      - cab-internal
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8084/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  operations-reporting-service:
    build:
      context: ./services/operations-reporting-service
    environment:
      OPERATIONS_DB_URL: postgresql://cab_operations:${OPERATIONS_DB_PASSWORD}@postgres:5432/cab_operations_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
      JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}
      FIELD_ENCRYPTION_KEY: ${FIELD_ENCRYPTION_KEY}
      FIELD_KEY_VERSION: ${FIELD_KEY_VERSION}
      INTERNAL_SERVICE_TOKEN: ${INTERNAL_SERVICE_TOKEN}
      RIDE_SERVICE_URL: http://ride-service:8082
      BILLING_SERVICE_URL: http://billing-service:8083
    volumes:
      - ./infra/secrets/jwt_public.pem:${JWT_PUBLIC_KEY_PATH}:ro
    expose:
      - "8085"
    networks:
      - cab-internal
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "/app/healthcheck", "http://localhost:8085/ready"]
      interval: 10s
      timeout: 3s
      retries: 10

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      IDENTITY_DB_PASSWORD: ${IDENTITY_DB_PASSWORD}
      RIDE_DB_PASSWORD: ${RIDE_DB_PASSWORD}
      BILLING_DB_PASSWORD: ${BILLING_DB_PASSWORD}
      NOTIFICATION_DB_PASSWORD: ${NOTIFICATION_DB_PASSWORD}
      OPERATIONS_DB_PASSWORD: ${OPERATIONS_DB_PASSWORD}
    expose:
      - "5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./infra/postgres/init/01-create-databases.sql:/docker-entrypoint-initdb.d/01-create-databases.sql:ro
    networks:
      - cab-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 5s
      timeout: 3s
      retries: 20

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_USER: cab
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: cab
    expose:
      - "5672"
      - "15672"
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
      - ./infra/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./infra/rabbitmq/definitions.json:/etc/rabbitmq/definitions.json:ro
    networks:
      - cab-internal
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 5s
      timeout: 5s
      retries: 20

networks:
  cab-internal:
    driver: bridge

volumes:
  postgres-data:
  rabbitmq-data:
```

Mỗi image ứng dụng phải `COPY` executable health probe tĩnh vào `/app/healthcheck`; probe chỉ gọi URL đối số và trả exit code khác 0 khi status không thuộc 2xx, nên không phụ thuộc `wget`/`curl` có sẵn trong base image. `infra/rabbitmq/rabbitmq.conf` chứa `management.load_definitions = /etc/rabbitmq/definitions.json`. File `definitions.json` khai báo vhost `cab`, permission `configure/write/read = .*` của user `cab`, `cab.domain`, `cab.audit`, toàn bộ queue/DLQ và binding đúng bảng 0.7; không chứa password hoặc password hash. Trên volume mới, image tạo user `cab` bằng `RABBITMQ_DEFAULT_PASS` rồi definitions cấp quyền/topology; trên volume đã tồn tại, biến mặc định không đổi password nên phải xoay bằng thủ tục quản trị có chủ đích. Smoke test bắt buộc chạy `rabbitmqctl authenticate_user cab "$RABBITMQ_PASSWORD"`, `rabbitmqctl list_vhosts` và `rabbitmqctl list_permissions -p cab`; CI còn so sánh `list_queues`/`list_bindings` để tránh drift.

Nội dung `infra/postgres/init/01-create-databases.sql`; `\getenv` lấy mật khẩu từ biến môi trường, không hard-code:

```sql
\getenv identity_password IDENTITY_DB_PASSWORD
\getenv ride_password RIDE_DB_PASSWORD
\getenv billing_password BILLING_DB_PASSWORD
\getenv notification_password NOTIFICATION_DB_PASSWORD
\getenv operations_password OPERATIONS_DB_PASSWORD
CREATE ROLE cab_identity LOGIN PASSWORD :'identity_password';
CREATE ROLE cab_ride LOGIN PASSWORD :'ride_password';
CREATE ROLE cab_billing LOGIN PASSWORD :'billing_password';
CREATE ROLE cab_notification LOGIN PASSWORD :'notification_password';
CREATE ROLE cab_operations LOGIN PASSWORD :'operations_password';
CREATE DATABASE cab_identity_db OWNER cab_identity;
CREATE DATABASE cab_ride_db OWNER cab_ride;
CREATE DATABASE cab_billing_db OWNER cab_billing;
CREATE DATABASE cab_notification_db OWNER cab_notification;
CREATE DATABASE cab_operations_db OWNER cab_operations;
```

Khởi động và kiểm tra: `docker compose up -d`, `docker compose ps`, sau đó chạy collection `postman/CAB-smoke.postman_collection.json` qua Gateway.

### 0.6. Health check — Phiếu #6

| Mã | Endpoint | Ý nghĩa |
| --- | --- | --- |
| API-X01 | `GET /health` | Liveness Gateway; không gọi phụ thuộc; 200 `{"status":"healthy"}`. |
| API-X02 | `GET /ready` | Gateway đã nạp cấu hình và kết nối các route bắt buộc; 200 ready hoặc 503 not_ready. |
| API-X03 | `GET /health/services` | Gateway gọi song song `/health` và `/ready` nội bộ của 5 service, timeout 300 ms/service, tổng timeout 500 ms. |

`⚠ Giả định (bổ sung theo phiếu chấm)`: API-X01–X03 được gán trách nhiệm quản trị contract cho BC-05, nhưng thực thi tại Gateway vì Gateway không phải BC.

```json
{"status":"ready","services":{"identity-driver":{"status":"ready","latencyMs":12},"ride":{"status":"ready","latencyMs":18},"billing":{"status":"ready","latencyMs":15},"notification":{"status":"ready","latencyMs":21},"operations-reporting":{"status":"ready","latencyMs":17}}}
```

Khi Billing down, endpoint trả HTTP 503: `{"status":"degraded","services":{"billing":{"status":"down","latencyMs":300}}}`; các lời gọi khác vẫn hoàn tất song song nên một service không kéo dài quá tổng timeout.

### 0.7. Message broker — Phiếu #7

Chọn **RabbitMQ**: luồng pilot cần routing theo loại event, acknowledgement, retry theo khoảng 1/5/25 giây và DLQ; quy mô nhỏ, không yêu cầu replay lịch sử dài. Không chọn Kafka vì vận hành partition/KRaft và retention log nặng hơn nhu cầu 7 tuần; thứ tự cần thiết đã được bảo vệ bằng aggregate version và một queue theo consumer.

| Exchange/queue | Producer | Consumer | Event/routing key | TTL/retention | DLQ |
| --- | --- | --- | --- | --- | --- |
| `cab.domain` / `identity.ride-location` | Identity & Driver | Ride | `DriverLocationUpdated.v1` | durable đến ack | `identity.ride-location.dlq` |
| `cab.domain` / `ride.identity-state` | Ride | Identity & Driver | `RideAssigned.v1`, `TripStatusChanged.v1`, `RatingCreated.v1` | durable đến ack | `ride.identity-state.dlq` |
| `cab.domain` / `ride.billing` | Ride | Billing | `TripCompleted.v1` | durable đến ack | `ride.billing.dlq` |
| `cab.domain` / `identity.notification` | Identity & Driver | Notification | `DriverApplicationDecided.v1` | durable đến ack | `identity.notification.dlq` |
| `cab.domain` / `ride.notification` | Ride | Notification | `RideRequested.v1`, `RideOfferCreated.v1`, `RideAssigned.v1`, `RideRequestCancelled.v1`, `RideRequestNoDriverFound.v1`, `TripStatusChanged.v1` | durable đến ack | `ride.notification.dlq` |
| `cab.domain` / `billing.notification` | Billing | Notification | `FareFinalized.v1`, `FareReviewRequired.v1`, `PaymentStatusChanged.v1` | durable đến ack | `billing.notification.dlq` |
| `cab.domain` / `operations.notification` | Operations | Notification | `IncidentResolved.v1` | durable đến ack | `operations.notification.dlq` |
| `cab.domain` / `identity.operations` | Identity & Driver | Operations | `DriverLocationUpdated.v1`, `DriverApplicationDecided.v1` | 7 ngày pilot | `identity.operations.dlq` |
| `cab.domain` / `ride.operations` | Ride | Operations | `RideRequested.v1`, `RideOfferCreated.v1`, `RideOfferResponded.v1`, `RideAssigned.v1`, `RideRequestCancelled.v1`, `RideRequestNoDriverFound.v1`, `TripStatusChanged.v1`, `TripCompleted.v1`, `RatingCreated.v1` | 7 ngày pilot | `ride.operations.dlq` |
| `cab.domain` / `billing.operations` | Billing | Operations | `FareFinalized.v1`, `FareReviewRequired.v1`, `PaymentStatusChanged.v1` | 7 ngày pilot | `billing.operations.dlq` |
| `cab.audit` / `operations.audit` | Mọi service | Operations | `AuditRecorded.v1` | 7 ngày pilot | `operations.audit.dlq` |

Kiểm tra broker: `docker compose exec rabbitmq rabbitmq-diagnostics ping` và `rabbitmqctl list_queues name messages_ready messages_unacknowledged`. Management UI chỉ mở qua `docker compose exec`/SSH tunnel, không publish host. Khi tạo RideRequest, outbox publisher phải làm tăng message/consumer log của `RideRequested`; consumer lưu `eventId` trước side effect. Notification retry bằng delay queue 1/5/25 giây rồi DLQ theo DEC-37.

Riêng `ride.billing`, timeline lỗi được cố định để triển khai và test: lần giao đầu tại `t0`; nếu Billing `nack`/timeout thì giao lại sau 1 giây, 5 giây và 25 giây; sau lần retry thứ ba vẫn lỗi thì chuyển `ride.billing.dlq`. Operator chỉ replay từ DLQ sau khi khắc phục nguyên nhân và phải giữ nguyên `eventId`; `processed_events` cùng unique `fares.trip_id` khiến Billing không tạo Fare hai lần. ⚠ Giả định pilot: dùng cùng backoff DEC-37 cho queue Billing.

### 0.8. Scheduler/job định kỳ

Mọi job chạy được trên nhiều replica: lấy batch bằng `FOR UPDATE SKIP LOCKED` hoặc advisory lock, commit state/outbox trong cùng transaction và dùng khóa dedupe nêu dưới đây. Chu kỳ là cấu hình pilot, không thay đổi mốc nghiệp vụ tuyệt đối.

| Job | Service | Chu kỳ/trigger | Khóa an toàn/idempotency | Tác dụng |
| --- | --- | --- | --- | --- |
| `outbox-publisher` | Cả 5 service | Poll 250 ms hoặc wake-up nội bộ | khóa batch `published_at IS NULL`; chỉ ghi `published_at` sau broker confirm | Phát event bền vững; lỗi thì để lần sau gửi lại. |
| `cleanup-auth-idempotency` | Identity và các service có idempotency | OTP mỗi 1 phút; idempotency mỗi 1 giờ | xóa theo `expires_at`, batch giới hạn | Dọn OTP và response idempotency hết hạn. |
| `availability-stale-offline` | Identity & Driver | 30 giây | `last_location_at <= now()-300 seconds`, kiểm version | Tự chuyển OFFLINE và ghi outbox đúng một lần. |
| `offer-expiry` | Ride | 1 giây | offer PENDING có `expires_at <= now()`, khóa hàng | Chuyển EXPIRED/phát `RideOfferResponded`; không quyết định ACCEPT hợp lệ. |
| `dispatch-hard-stop` | Ride | 1 giây | khóa RideRequest SEARCHING theo `search_started_at` | Dừng ở 180 giây, chuyển NO_DRIVER_FOUND và phát event một lần. |
| `payment-reconciliation` | Billing | 1 phút | khóa PaymentAttempt UNKNOWN, dedupe provider event | Hỏi mock provider và chốt SUCCEEDED/FAILED hoặc giữ UNKNOWN. |
| `stuck-trip-detector` | Operations & Reporting | 1 phút | key `(trip_id,threshold_type)` trong `processed_events` | Khi Trip vượt nghiêm ngặt 30 phút ở trạng thái bị theo dõi, tạo một Incident SYSTEM. |

⚠ Giả định pilot: các chu kỳ 250 ms/1 phút/1 giờ/30 giây ở bảng trên có thể cấu hình; các ngưỡng nghiệp vụ 20 giây, 180 giây, 300 giây và 30 phút vẫn theo SRS và được kiểm lại bằng thời gian trong transaction.

## Phần II. Thiết kế từng Bounded Context

### BC-01 — Identity & Driver → `identity-driver-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-01 sở hữu danh tính, hồ sơ và điều kiện hoạt động của tài xế. Có thể tách Identity khỏi Driver Location khi quy mô tăng, nhưng pilot giữ chung vì điều kiện ONLINE cần đồng thời User ACTIVE, DriverApplication APPROVED, Vehicle ACTIVE và vị trí mới. Ride tự bảo vệ invariant tài xế không có Trip/offer mở; Availability.ON_TRIP chỉ là projection đồng bộ trễ. Kết luận chi tiết ở Phần I.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-01–06, FR-21, FR-43, FR-45, FR-47, FR-49–51 | Phone duy nhất; hồ sơ/xe hợp lệ; vị trí mới hơn thắng; khóa phiên; bảo mật/rate limit. |
| UC | UC-01.1, 01.2, 02, 03.1, 03.2, 04, 08, 16.2, 16.3, 16.5, 16.6 | Bao phủ đăng ký, đăng nhập, hồ sơ, availability, location và quản trị tài khoản. |
| DEC/NFR | DEC-02, 09, 18, 25, 26, 29, 30, 33–35, 38; NFR-04–07, 09, 16 | Một phone/một role; 5 lần sai khóa 15 phút; idempotency; location >300 giây tự OFFLINE; TLS/log masking. |
| Phiếu chấm | #9–13, #21–23, #24–29 | Account/driver smoke test, GEO 1 km, OTP/duyệt, availability và bảo mật. |

Mục tiêu trong luồng: tạo actor hợp lệ trước đặt xe; cung cấp candidate/driver snapshot cho Ride; không quyết định ACCEPT hoặc Trip.

```mermaid
stateDiagram-v2
  [*] --> PENDING_REVIEW: driver registration + OTP verified
  PENDING_REVIEW --> APPROVED: OPERATOR approve
  PENDING_REVIEW --> REJECTED: OPERATOR reject
  APPROVED --> OFFLINE: activate profile and vehicle
  OFFLINE --> ONLINE: eligibility valid
  ONLINE --> ON_TRIP: RideAssigned event, projection
  ON_TRIP --> ONLINE: Trip ended event, projection
  ONLINE --> OFFLINE: driver toggles or location age >300s
```

#### Bước 3. Microservice

- Service/database/container/port: `identity-driver-service` / `cab_identity_db` / `identity-driver-service` / 8081.
- Health nội bộ: `GET /health`, `GET /ready`.
- API sở hữu: API-01–API-10.
- Aggregate root: `User`, `DriverApplication`, `Vehicle`, `Availability`, `DriverLocation`.
- Phát: `DriverApplicationDecided.v1`, `DriverLocationUpdated.v1`, `AuditRecorded.v1`. Để giảm tải outbox, `DriverLocationUpdated.v1` chỉ phát khi request location có `tripId` khác null; Ride vẫn lấy candidate hiện tại qua REST.
- Tiêu thụ: `RideAssigned.v1`, `TripStatusChanged.v1` để cập nhật projection Availability.ON_TRIP; `RatingCreated.v1` để cập nhật ratingAverage đúng một lần theo eventId. BC-01 không bảo vệ invariant Trip và không sửa Trip.
- REST ra ngoài: Ride internal query candidate/driver snapshot gọi vào BC này; BC này không gọi database khác.
- Quyền: Public cho API-01/02/03/04; API-04 xác thực và xoay refresh token trong body, không yêu cầu access JWT còn hạn. CUSTOMER/DRIVER cho API-05; DRIVER cho API-06/07; ADMIN API-08; OPERATOR API-09/10.
- Contract kỹ thuật: BC-01 quản trị DEC-34/ENT-23 và ENT-27; service áp dụng IdempotencyRecord cục bộ, OutboxEvent cục bộ theo contract ENT-24 của BC-05; rate limit được Gateway thực thi theo contract BC-01.

API bổ sung theo phiếu chấm:

| Mã | Method/path | Role | Mục đích |
| --- | --- | --- | --- |
| API-X04 | `GET /api/v1/operations/customers/{id}` | OPERATOR | Phiếu #11, xem Customer theo mã. |
| API-X05 | `GET /api/v1/operations/drivers/{id}` | OPERATOR | Phiếu #12, xem Driver theo mã. |
| API-X06 | `GET /api/v1/operations/drivers/nearby?lat=10.776889&lng=106.700806&radiusMeters=1000&limit=20&cursor=NDg5OjEwMDAwMDAw` | OPERATOR | Phiếu #13, driver trong 1 km, limit/cursor. |
| API-X08 | `POST /api/v1/auth/driver-registrations/otp-requests` | Public | Gửi OTP đăng ký tài xế. |
| API-X09 | `POST /api/v1/auth/driver-registrations/otp-verifications` | Public | Xác minh OTP, trả `otpVerificationId`. |
| API-X10 | `GET /api/v1/operations/driver-applications` | OPERATOR | Danh sách hồ sơ chờ duyệt. |
| API-X11 | `GET /api/v1/operations/driver-applications/{id}` | OPERATOR | Chi tiết hồ sơ. |
| API-X12 | `PATCH /api/v1/operations/driver-applications/{id}` | OPERATOR | APPROVE/REJECT theo version. |

`⚠ Giả định (bổ sung theo phiếu chấm)`: OTP sống 5 phút, tối đa 5 lần xác minh/challenge; chỉ lưu hash OTP. API-02 nhận thêm `otpVerificationId`. SRS chưa có OTP và API-X04–X12.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| User | ENT-01 | aggregate root | Tài khoản, role và trạng thái đăng nhập. |
| CustomerProfile | ENT-02 | entity | Hồ sơ CUSTOMER 1–1 User. |
| DriverProfile | ENT-03 | aggregate root | Hồ sơ nghiệp vụ tài xế. |
| Vehicle | ENT-04 | aggregate root | Xe duy nhất ACTIVE của tài xế pilot. |
| DriverLocation | ENT-07 | aggregate root | Vị trí mới nhất/chuỗi vị trí tài xế. |
| DriverApplication | ENT-19 | aggregate root | Hồ sơ chờ duyệt. |
| DriverDocument | ENT-20 | entity | Tài liệu riêng tư của tài xế. |
| Availability | ENT-21 | aggregate root | OFFLINE/ONLINE/ON_TRIP độc lập User. |
| VehicleType | ENT-22 | entity tham chiếu | Danh mục MOTORBIKE/CAR_4_SEAT. |
| IdempotencyRecord | ENT-23 | entity kỹ thuật chuẩn | Contract idempotency; instance cục bộ ở từng service. |
| RefreshToken | ENT-25 | entity | Hash refresh token và thu hồi. |
| LoginAttempt | ENT-26 | entity | Cửa sổ đăng nhập sai. |
| RateLimitCounter | ENT-27 | value record hạ tầng | Contract đếm rate tại Gateway. |
| OtpChallenge | `⚠ Giả định`, ngoài danh mục entity chuẩn | entity | Challenge OTP đăng ký tài xế, chỉ lưu hash và hạn dùng. |

| Field | Kiểu logic | Bắt buộc (Y/N) | Duy nhất (Y/N) | Ràng buộc/Nguồn SRS |
| --- | --- | --- | --- | --- |
| User.id | id | Y | Y | ENT-01. |
| User.phone | E.164(15) | Y | Y | FR-01; số điện thoại đăng nhập. |
| User.passwordHash | text(255) | Y | N | FR-01; không trả qua API. |
| User.roles | set\<Role\> | Y | N | DEC-33; chứa đúng một role. |
| User.status | enum | Y | N | PENDING→ACTIVE↔LOCKED→DISABLED. |
| User.mustChangePassword | boolean | Y | N | FR-04; bắt buộc đổi mật khẩu tài khoản seed. |
| CustomerProfile.userId | id | Y | Y | Quan hệ logic 1–1 User. |
| CustomerProfile.fullName | text(120) | Y | N | FR-01. |
| CustomerProfile.createdAt | thời điểm | Y | N | Do server tạo. |
| DriverProfile.userId | id | Y | Y | Quan hệ logic 1–1 User. |
| DriverProfile.fullName | text(120) | Y | N | FR-03. |
| DriverProfile.ratingAverage | số thực | N | N | Giá trị 1..5 khi đã có đánh giá. |
| DriverProfile.version | số nguyên | Y | N | Optimistic concurrency. |
| Vehicle.id | id | Y | Y | ENT-04. |
| Vehicle.driverId | id | Y | Y | Pilot: một Vehicle ACTIVE/tài xế. |
| Vehicle.vehicleTypeId | id | Y | N | Tham chiếu VehicleType nội bộ. |
| Vehicle.plate | text(15) | Y | Y | FR-03; biển số duy nhất. |
| Vehicle.status | enum | Y | N | ACTIVE/INACTIVE. |
| DriverLocation.driverId | id | Y | N | Tham chiếu DriverProfile. |
| DriverLocation.lat | số thực | Y | N | WGS84, -90..90. |
| DriverLocation.lng | số thực | Y | N | WGS84, -180..180. |
| DriverLocation.receivedAt | thời điểm | Y | N | Bản mới hơn thắng. |
| DriverLocation.tripId | id | N | N | `ref → BC-02`. |
| DriverApplication.id | id | Y | Y | ENT-19. |
| DriverApplication.driverId | id | Y | Y | Một hồ sơ pilot/tài xế. |
| DriverApplication.status | enum | Y | N | PENDING_REVIEW→APPROVED/REJECTED. |
| DriverApplication.reviewerId | id | N | N | Tham chiếu User có role OPERATOR. |
| DriverApplication.reason | text(500) | N | N | Lý do từ chối/ghi chú duyệt. |
| DriverDocument.id | id | Y | Y | ENT-20. |
| DriverDocument.driverId | id | Y | N | Tham chiếu DriverProfile. |
| DriverDocument.type | enum | Y | N | Loại giấy tờ theo FR-03. |
| DriverDocument.fileKey | text(255) | Y | Y | Khóa đối tượng tài liệu. |
| DriverDocument.maskedValue | text(80) | Y | N | Giá trị đã che để hiển thị. |
| DriverDocument.status | enum | Y | N | Trạng thái kiểm duyệt. |
| Availability.driverId | id | Y | Y | Quan hệ logic 1–1 DriverProfile. |
| Availability.status | enum | Y | N | OFFLINE/ONLINE/ON_TRIP. |
| Availability.lastLocationAt | thời điểm | N | N | Quá 300 giây tự OFFLINE. |
| Availability.version | số nguyên | Y | N | Optimistic concurrency. |
| VehicleType.id | id | Y | Y | ENT-22. |
| VehicleType.code | text(30) | Y | Y | MOTORBIKE/CAR_4_SEAT. |
| VehicleType.name | text(80) | Y | N | Tên hiển thị. |
| VehicleType.active | boolean | Y | N | Chỉ loại active được chọn. |
| IdempotencyRecord.subjectId | id | Y | N | Thành phần khóa logic cùng key. |
| IdempotencyRecord.key | id | Y | N | Thành phần khóa logic cùng subjectId. |
| IdempotencyRecord.payloadHash | text(64) | Y | N | Phát hiện dùng lại key khác payload. |
| IdempotencyRecord.response | JSON | N | N | Có khi xử lý hoàn tất. |
| IdempotencyRecord.expiresAt | thời điểm | Y | N | TTL 24 giờ. |
| RefreshToken.id | id | Y | Y | ENT-25. |
| RefreshToken.userId | id | Y | N | Tham chiếu User. |
| RefreshToken.tokenHash | text(255) | Y | Y | Không lưu token gốc. |
| RefreshToken.expiresAt | thời điểm | Y | N | Hạn refresh token. |
| RefreshToken.revokedAt | thời điểm | N | N | Có giá trị sau logout/thu hồi. |
| LoginAttempt.id | id | Y | Y | ENT-26. |
| LoginAttempt.phoneHash | text(64) | Y | N | Nhận diện cửa sổ đăng nhập. |
| LoginAttempt.ip | text(45) | Y | N | IPv4/IPv6. |
| LoginAttempt.success | boolean | Y | N | Kết quả lần thử. |
| LoginAttempt.attemptedAt | thời điểm | Y | N | Tính cửa sổ 15 phút. |
| RateLimitCounter.scopeKey | text(160) | Y | Y | ENT-27; khóa scope/cửa sổ. |
| RateLimitCounter.windowStart | thời điểm | Y | N | DEC-30. |
| RateLimitCounter.count | số nguyên | Y | N | Không âm. |
| RateLimitCounter.expiresAt | thời điểm | Y | N | Hết cửa sổ thì loại bỏ. |
| OtpChallenge.id | id | Y | Y | `⚠ Giả định` phiếu #21. |
| OtpChallenge.phoneHash | text(64) | Y | N | Nhận diện phone không dùng plaintext. |
| OtpChallenge.otpHash | text(255) | Y | N | Không lưu OTP gốc. |
| OtpChallenge.attempts | số nguyên | Y | N | Tối đa 5. |
| OtpChallenge.expiresAt | thời điểm | Y | N | Sống 5 phút. |
| OtpChallenge.verifiedAt | thời điểm | N | N | Có khi xác minh thành công. |

Quan hệ: User 1–1 CustomerProfile hoặc 1–1 DriverProfile; DriverProfile 1–1 DriverApplication, 1–N DriverDocument, 1–N Vehicle nhưng đúng một Vehicle ACTIVE, 1–1 Availability và 1–N DriverLocation. Tham chiếu `tripId` chỉ là ID BC-02, không có ràng buộc liên context.

Invariant: phone duy nhất và một role; chỉ application APPROVED + Vehicle ACTIVE + User ACTIVE mới ONLINE; location tuổi ≤60 giây mới dùng matching, >300 giây tự OFFLINE; vị trí cũ không ghi đè mới; tốc độ suy ra >120 km/h không cộng distance.

```mermaid
erDiagram
  User ||--o| CustomerProfile : has
  User ||--o| DriverProfile : has
  DriverProfile ||--|| DriverApplication : submits
  DriverProfile ||--o{ DriverDocument : owns
  DriverProfile ||--o{ Vehicle : registers
  DriverProfile ||--|| Availability : controls
  DriverProfile ||--o{ DriverLocation : reports
  VehicleType ||--o{ Vehicle : classifies
  User ||--o{ RefreshToken : owns
  User ||--o{ LoginAttempt : causes
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Database `cab_identity_db`, user `cab_identity`. Quan hệ User–Profile–Vehicle–Availability, phone/plate duy nhất và quyết định duyệt theo version cần transaction/constraint. Vị trí hiện tại dùng upsert và Haversine SQL; OTP/idempotency dùng hàng có `expires_at`; đăng nhập sai truy vấn ENT-26. Service không truy cập database khác.

##### 5.2. Mô hình vật lý

Các bảng chính: `users`, `customer_profiles`, `driver_profiles`, `vehicles`, `driver_locations`, `driver_applications`, `driver_documents`, `availabilities`, `vehicle_types`, `refresh_tokens`, `login_attempts`, `idempotency_records`, `processed_events`, `outbox_events`. PK UUID; index unique trên blind index phone/plate; `(driver_id, received_at DESC)` cho location; `(status, received_at)` cho application.

Mọi field logic ở Bước 4 ánh xạ sang cột `snake_case` cùng tên trong bảng của entity. Ngoại lệ vật lý: `User.phone`, `CustomerProfile.fullName`, `DriverProfile.fullName`, `Vehicle.plate`, `DriverDocument.fileKey/maskedValue` được tách thành `*_ciphertext`; các cột `*_nonce`, `*_key_version`, `*_blind_index` là cột kỹ thuật chỉ phục vụ mã hóa/tìm duy nhất. `DriverProfile.rating_sum/rating_count` là accumulator kỹ thuật để sinh `rating_average` chính xác; `DriverLocation` có thêm read model `driver_current_locations`; `IdempotencyRecord` có thêm `state`; `OutboxEvent` dùng các cột kỹ thuật retry/publish. Không field logic nào bị loại bỏ bởi các biểu diễn vật lý này.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  phone_ciphertext bytea NOT NULL,
  phone_nonce bytea NOT NULL,
  phone_key_version text NOT NULL,
  phone_blind_index char(64) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  roles varchar(20)[] NOT NULL CHECK (
    cardinality(roles)=1 AND roles[1] IN ('CUSTOMER','DRIVER','OPERATOR','ADMIN','EXECUTIVE')
  ),
  status varchar(16) NOT NULL CHECK (status IN ('PENDING','ACTIVE','LOCKED','DISABLED')),
  must_change_password boolean NOT NULL
);
CREATE TABLE driver_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  full_name_ciphertext bytea NOT NULL,
  full_name_nonce bytea NOT NULL,
  full_name_key_version text NOT NULL,
  rating_sum bigint NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_average numeric(2,1) GENERATED ALWAYS AS (
    CASE WHEN rating_count=0 THEN NULL
         ELSE round(rating_sum::numeric/rating_count,1) END
  ) STORED,
  version integer NOT NULL CHECK (version > 0)
);
CREATE TABLE customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  full_name_ciphertext bytea NOT NULL,
  full_name_nonce bytea NOT NULL,
  full_name_key_version text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE vehicle_types (
  id uuid PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE CHECK (code IN ('MOTORBIKE','CAR_4_SEAT')),
  name varchar(80) NOT NULL,
  active boolean NOT NULL
);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES driver_profiles(user_id),
  vehicle_type_id uuid NOT NULL REFERENCES vehicle_types(id),
  plate_ciphertext bytea NOT NULL,
  plate_nonce bytea NOT NULL,
  plate_key_version text NOT NULL,
  plate_blind_index char(64) NOT NULL UNIQUE,
  status varchar(20) NOT NULL CHECK (status IN ('ACTIVE','INACTIVE'))
);
CREATE UNIQUE INDEX uq_active_vehicle_driver ON vehicles(driver_id) WHERE status='ACTIVE';
CREATE TABLE driver_applications (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL UNIQUE REFERENCES driver_profiles(user_id),
  status varchar(20) NOT NULL CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
  reviewer_id uuid REFERENCES users(id),
  reason varchar(500),
  version integer NOT NULL CHECK (version > 0)
);
CREATE INDEX ix_driver_applications_status ON driver_applications(status);
CREATE TABLE driver_documents (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES driver_profiles(user_id),
  type varchar(32) NOT NULL,
  file_key_ciphertext bytea NOT NULL,
  file_key_nonce bytea NOT NULL,
  file_key_key_version text NOT NULL,
  masked_value_ciphertext bytea NOT NULL,
  masked_value_nonce bytea NOT NULL,
  masked_value_key_version text NOT NULL,
  status varchar(20) NOT NULL
);
CREATE TABLE availabilities (
  driver_id uuid PRIMARY KEY REFERENCES driver_profiles(user_id),
  status varchar(12) NOT NULL CHECK (status IN ('OFFLINE','ONLINE','ON_TRIP')),
  last_location_at timestamptz,
  version integer NOT NULL CHECK (version > 0)
);
CREATE TABLE driver_locations (
  driver_id uuid NOT NULL REFERENCES driver_profiles(user_id),
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  received_at timestamptz NOT NULL,
  trip_id uuid,
  PRIMARY KEY (driver_id, received_at)
);
CREATE TABLE driver_current_locations (
  driver_id uuid PRIMARY KEY REFERENCES driver_profiles(user_id),
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  received_at timestamptz NOT NULL,
  trip_id uuid
);
CREATE INDEX ix_driver_current_locations_lat_lng ON driver_current_locations(lat, lng);
CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY,
  phone_hash char(64) NOT NULL,
  otp_hash varchar(255) NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz
);
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(255) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE login_attempts (
  id uuid PRIMARY KEY,
  phone_hash char(64) NOT NULL,
  ip_ciphertext bytea NOT NULL,
  ip_nonce bytea NOT NULL,
  ip_key_version text NOT NULL,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL
);
CREATE INDEX ix_login_attempts_window ON login_attempts(phone_hash, attempted_at DESC);
CREATE TABLE idempotency_records (
  subject_id uuid NOT NULL,
  key uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  state varchar(12) NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  response jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, key)
);
CREATE TABLE processed_events (
  event_id uuid PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX ix_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;
```

Upsert vị trí hiện tại không cho event đến trễ ghi đè bản mới:

```sql
INSERT INTO driver_current_locations(driver_id,lat,lng,received_at,trip_id)
VALUES (:driver_id,:lat,:lng,:received_at,:trip_id)
ON CONFLICT (driver_id) DO UPDATE
SET lat=EXCLUDED.lat, lng=EXCLUDED.lng,
    received_at=EXCLUDED.received_at, trip_id=EXCLUDED.trip_id
WHERE EXCLUDED.received_at > driver_current_locations.received_at;
```

Truy vấn phiếu #13 lọc bounding box quanh `10.776889,106.700806`, sau đó tính Haversine trong SQL và giữ `distance_meters<=1000`, sắp `(distanceMeters,driverId)`, lấy `limit+1` với `limit≤100`. Cursor là cặp cuối, ổn định hơn offset. `driver_current_locations` phục vụ truy vấn mới nhất; `driver_locations` giữ lịch sử ENT-07 để cộng quãng đường. Consumer `RatingCreated.v1` insert `processed_events`, tăng `rating_sum/rating_count` và `version` trong cùng transaction; eventId trùng không tăng lần hai, còn `rating_average` được PostgreSQL sinh lại để lần lấy snapshot kế tiếp thấy giá trị mới. Job xóa OTP/idempotency hết hạn; LoginAttempt được query trực tiếp trong cửa sổ 15 phút.

Bảo vệ: password dùng Argon2id có salt; định dạng minh họa, không phải hash thật: `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>`. Password không mã hóa thuận nghịch. Phone/fullName/plate/fileKey dùng AES-256-GCM, lưu ciphertext/nonce/keyVersion; khóa ngoài DB, xoay theo version; phone/plate tìm bằng HMAC blind index. Tất cả query dùng parameter binding, DB user chỉ có quyền database này.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| User, CustomerProfile, DriverProfile, Vehicle | `users`, `customer_profiles`, `driver_profiles`, `vehicles` |
| DriverLocation, Availability, VehicleType | `driver_locations` + `driver_current_locations`, `availabilities`, `vehicle_types` |
| DriverApplication, DriverDocument | `driver_applications`, `driver_documents` |
| IdempotencyRecord, RefreshToken, LoginAttempt | `idempotency_records`, `refresh_tokens`, `login_attempts`; `processed_events` là bảng kỹ thuật dedupe event consumer. |
| RateLimitCounter | Không có bảng vật lý; Gateway một instance giữ bộ đếm trong bộ nhớ theo contract ENT-27. |
| OtpChallenge (`⚠ Giả định`) | `otp_challenges`; entity bổ sung theo phiếu #21, không thuộc danh mục entity chuẩn. |

#### Bước 6. Ubiquitous Language

| Thuật ngữ | Định nghĩa | Ghi chú/Ví dụ |
| --- | --- | --- |
| User | Danh tính đăng nhập theo phone duy nhất. | Không đồng nghĩa CustomerProfile. |
| CustomerProfile | Hồ sơ hiển thị của CUSTOMER. | `fullName`, không chứa trip. |
| DriverProfile | Hồ sơ nghiệp vụ tài xế. | Chỉ APPROVED mới có thể ONLINE. |
| DriverApplication | Đơn đăng ký tài xế. | PENDING_REVIEW/APPROVED/REJECTED. |
| DriverDocument | GPLX, CCCD hoặc đăng ký xe riêng tư. | API chỉ trả maskedValue. |
| Vehicle | Xe của Driver. | Pilot đúng một xe ACTIVE. |
| VehicleType | Loại xe cấu hình. | MOTORBIKE hoặc CAR_4_SEAT. |
| Availability | Trạng thái nhận chuyến. | OFFLINE/ONLINE/ON_TRIP; không phải User.status. |
| DriverLocation | Tọa độ WGS84 có receivedAt. | 60 giây còn dùng matching; 301 giây tự OFFLINE. |
| RefreshToken | Token đổi access token. | Chỉ lưu tokenHash. |
| LoginAttempt | Một lần đăng nhập thành công/thất bại. | Lần sai thứ 5 trong 15 phút khóa. |
| IdempotencyRecord | Kết quả giữ theo subject/key. | TTL 24 giờ. |
| RateLimitCounter | Bộ đếm cửa sổ rate. | Yêu cầu sau đúng giới hạn trả 429. |

### BC-02 — Ride → `ride-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-02 giữ RideRequest, matching/offer và Trip chung để transaction ACCEPT kiểm tra Offer PENDING, chưa hết hạn và RideRequest SEARCHING rồi tạo đúng một Trip. Tách matching khỏi Trip ở pilot làm tăng rủi ro double assignment; không nên phân rã.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-07–20, FR-22, FR-28–30, FR-39, FR-48, FR-53 | Đặt xe, điều phối, state Trip, lịch sử và rating. |
| UC | UC-05.1, 05.2, 06.1–06.3, 07.1–07.2, 09.1–09.2, 10, 14, 15 | Toàn bộ vòng đời request/offer/trip/rating. |
| DEC/NFR | DEC-03–05, 13, 16, 17, 19, 20, 24, 36; NFR-01–03, 11, 14 | 5 km, offer 20 giây, hard stop 180 giây, concurrency/version, ownership. |
| Phiếu chấm | #14–18, #20, #30 | Booking list/create, accept, Trip sequence/cancel, review, replay. |

```mermaid
stateDiagram-v2
  [*] --> SEARCHING: create RideRequest
  SEARCHING --> ASSIGNED: winning ACCEPT
  SEARCHING --> CANCELLED: customer cancel
  SEARCHING --> NO_DRIVER_FOUND: exhausted or 180s
  ASSIGNED --> ARRIVED_AT_PICKUP
  ARRIVED_AT_PICKUP --> PICKED_UP
  PICKED_UP --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED
  ASSIGNED --> CANCELLED: before PICKED_UP
  ARRIVED_AT_PICKUP --> CANCELLED: before PICKED_UP
  PICKED_UP --> TERMINATED_BY_INCIDENT: operator resolution
  IN_PROGRESS --> TERMINATED_BY_INCIDENT: operator resolution
```

#### Bước 3. Microservice

- Service/database/container/port: `ride-service` / `cab_ride_db` / `ride-service` / 8082; health `/health`, readiness `/ready`.
- API sở hữu: API-11–API-17; API-X07 bổ sung `GET /api/v1/ride-requests?customerId=me&page=1&size=20` cho phiếu #14.
- Aggregate root: RideRequest, RideOffer, Trip, Rating.
- Phát: `RideRequested.v1`, `RideOfferCreated.v1`, `RideOfferResponded.v1`, `RideAssigned.v1`, `RideRequestCancelled.v1`, `RideRequestNoDriverFound.v1`, `TripStatusChanged.v1`, `TripCompleted.v1`, `RatingCreated.v1`, `AuditRecorded.v1`. Hai event outcome bổ sung là nguồn fact cho Acceptance Rate và Find-driver Rate.
- Tiêu thụ: `DriverLocationUpdated.v1` để cộng distance khi Trip IN_PROGRESS. Candidate/availability lấy đồng bộ, còn lệnh Incident dùng REST.
- REST đồng bộ: query candidate/snapshot ở BC-01, fare estimate ở BC-03. Role/ownership theo manifest.
- Contract kỹ thuật: service áp dụng DEC-34/IdempotencyRecord cục bộ và ENT-27 theo contract BC-01; OutboxEvent cục bộ theo contract ENT-24 của BC-05.

`⚠ Giả định (bổ sung theo phiếu chấm)`: API-X07 dùng page 1..1000, size 1..100 như BC-12 và chỉ trả RideRequest của `sub`; SRS UC-14 có lịch sử nhưng §12.1 chưa có endpoint.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| RideRequest | ENT-05 | aggregate root | Yêu cầu tìm xe; giữ quote và price version ref. |
| Trip | ENT-06 | aggregate root | Chuyến được gán và state machine. |
| Rating | ENT-11 | aggregate root | Một đánh giá cho một Trip. |
| RideOffer | ENT-13 | aggregate root | Lời mời tài xế có hạn. |
| StatusHistory | ENT-15 | entity bất biến | Lịch sử chuyển trạng thái RideRequest/Trip. |

| Field | Kiểu logic | Bắt buộc (Y/N) | Duy nhất (Y/N) | Ràng buộc/Nguồn SRS |
| --- | --- | --- | --- | --- |
| RideRequest.id | id | Y | Y | ENT-05. |
| RideRequest.customerId | id | Y | N | `ref → BC-01`. |
| RideRequest.pickup | GeoPoint | Y | N | Vùng lat 10.35..11.20, lng 106.35..107.05. |
| RideRequest.destination | GeoPoint | Y | N | Cùng vùng phục vụ pickup. |
| RideRequest.vehicleTypeId | id | Y | N | `ref → BC-01`. |
| RideRequest.quotedFareVnd | tiền | N | N | Snapshot estimate từ BC-03. |
| RideRequest.priceVersionId | id | N | N | `ref → BC-03`. |
| RideRequest.status | enum | Y | N | SEARCHING→ASSIGNED/NO_DRIVER_FOUND/CANCELLED. |
| RideRequest.version | số nguyên | Y | N | Optimistic concurrency. |
| Trip.id | id | Y | Y | ENT-06. |
| Trip.rideRequestId | id | Y | Y | Một Trip tối đa cho RideRequest. |
| Trip.customerId | id | Y | N | Sao chép từ RideRequest khi ACCEPT; `ref → BC-01`, dùng bảo vệ Trip mở/customer. |
| Trip.driverId | id | Y | N | `ref → BC-01`. |
| Trip.driverFullNameSnapshot | text(120) | Y | N | `⚠ Giả định`: snapshot BC-01 lúc ACCEPT để đáp ứng API-16. |
| Trip.driverPlateSnapshot | text(15) | Y | N | `⚠ Giả định`: snapshot BC-01 lúc ACCEPT để đáp ứng API-16. |
| Trip.driverVehicleTypeSnapshot | text(30) | Y | N | `⚠ Giả định`: snapshot BC-01 lúc ACCEPT để đáp ứng API-16. |
| Trip.driverRatingAverageSnapshot | số thực | N | N | `⚠ Giả định`: snapshot BC-01 lúc ACCEPT để đáp ứng API-16. |
| Trip.status | enum | Y | N | Không lùi trạng thái. |
| Trip.distanceMeters | số nguyên | N | N | Không âm. |
| Trip.distanceSource | enum | N | N | GPS/OPERATOR_ESTIMATE. |
| Trip.validPointCount | số nguyên | N | N | Số điểm GPS hợp lệ; nhỏ hơn 2 bắt buộc Fare review. |
| Trip.version | số nguyên | Y | N | Optimistic concurrency. |
| Rating.id | id | Y | Y | ENT-11. |
| Rating.tripId | id | Y | Y | Một Rating/Trip. |
| Rating.customerId | id | Y | N | `ref → BC-01`; phải sở hữu Trip. |
| Rating.score | số nguyên | Y | N | 1..5, trong 7 ngày. |
| Rating.comment | text(500) | N | N | Nội dung người dùng. |
| RideOffer.id | id | Y | Y | ENT-13. |
| RideOffer.rideRequestId | id | Y | N | Tham chiếu RideRequest. |
| RideOffer.driverId | id | Y | N | Một driver tối đa một PENDING. |
| RideOffer.expiresAt | thời điểm | Y | N | Hạn offer 20 giây. |
| RideOffer.status | enum | Y | N | PENDING/ACCEPTED/DECLINED/EXPIRED/CANCELLED. |
| RideOffer.version | số nguyên | Y | N | Optimistic concurrency. |
| StatusHistory.id | id | Y | Y | ENT-15. |
| StatusHistory.aggregateType | enum | Y | N | RideRequest hoặc Trip. |
| StatusHistory.aggregateId | id | Y | N | ID aggregate nguồn. |
| StatusHistory.fromStatus | text(40) | N | N | Null khi khởi tạo. |
| StatusHistory.toStatus | text(40) | Y | N | Trạng thái mới. |
| StatusHistory.actorId | id | N | N | `ref → BC-01`; null cho SYSTEM. |
| StatusHistory.at | thời điểm | Y | N | Append-only. |

Quan hệ: RideRequest 1–N RideOffer; RideRequest 0–1 Trip; Trip 0–1 Rating; RideRequest/Trip 1–N StatusHistory. Invariant: customer tối đa một request/trip mở; driver tối đa một Trip ở trạng thái mở và một RideOffer PENDING; không mở offer sau giây 160; offer kết thúc ≤180. Theo DEC-16, mỗi vòng chọn tối đa 3 candidate, tối đa 3 vòng, toàn phiên xét không quá 10 candidate và vì vậy phát tối đa 9 offer. ACCEPT cạnh tranh chỉ một winner; hủy Trip chỉ trước PICKED_UP, sau đó dùng Incident.

```mermaid
erDiagram
  RideRequest ||--o{ RideOffer : dispatches
  RideRequest ||--o| Trip : becomes
  Trip ||--o| Rating : receives
  RideRequest ||--o{ StatusHistory : records
  Trip ||--o{ StatusHistory : records
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Database `cab_ride_db`, user `cab_ride`. ACCEPT cạnh tranh, version/state transition và một Trip/driver mở cần transaction, khóa hàng và partial unique index. Offer timer/hard stop lấy từ `expires_at`/`search_started_at`; idempotency lưu trong bảng cục bộ. Ride là service duy nhất truy cập database này.

##### 5.2. Mô hình vật lý

`ride_requests`, `ride_offers`, `trips`, `ratings`, `status_history`, `idempotency_records`, `processed_events`, `outbox_events`. Index: partial unique customer request SEARCHING; partial unique driver offer PENDING; `(ride_request_id,status,expires_at)`; `(customer_id,status)`; `(driver_id,status)`.

Mọi field logic ánh xạ sang cột `snake_case` cùng tên; `pickup` và `destination` tách thành cặp `*_lat/*_lng`. Các cột `search_started_at`, `state` của idempotency, `processed_events` và metadata retry/publish của outbox là cấu trúc kỹ thuật. Bốn snapshot tài xế đều nằm trong `trips`; tên và biển số dùng `*_ciphertext`, còn `*_nonce`, `*_key_version` chỉ là metadata mã hóa vật lý. Compose truyền khóa mã hóa pilot cho Ride; Customer chỉ nhận bản rõ qua API-16 sau kiểm tra ownership.

```sql
CREATE TABLE ride_requests (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  pickup_lat numeric(9,6) NOT NULL,
  pickup_lng numeric(9,6) NOT NULL,
  destination_lat numeric(9,6) NOT NULL,
  destination_lng numeric(9,6) NOT NULL,
  vehicle_type_id uuid NOT NULL,
  quoted_fare_vnd bigint,
  price_version_id uuid,
  search_started_at timestamptz NOT NULL,
  status varchar(24) NOT NULL CHECK (status IN ('SEARCHING','ASSIGNED','NO_DRIVER_FOUND','CANCELLED')),
  version integer NOT NULL CHECK (version > 0)
);
CREATE UNIQUE INDEX uq_searching_ride_request_customer
  ON ride_requests(customer_id) WHERE status='SEARCHING';
CREATE TABLE ride_offers (
  id uuid PRIMARY KEY,
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id),
  driver_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  status varchar(12) NOT NULL CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  version integer NOT NULL CHECK (version > 0)
);
CREATE UNIQUE INDEX uq_pending_offer_driver ON ride_offers(driver_id) WHERE status='PENDING';
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  ride_request_id uuid NOT NULL UNIQUE REFERENCES ride_requests(id),
  customer_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  driver_full_name_ciphertext bytea NOT NULL,
  driver_full_name_nonce bytea NOT NULL,
  driver_full_name_key_version text NOT NULL,
  driver_plate_ciphertext bytea NOT NULL,
  driver_plate_nonce bytea NOT NULL,
  driver_plate_key_version text NOT NULL,
  driver_vehicle_type_snapshot varchar(30) NOT NULL,
  driver_rating_average_snapshot numeric(2,1),
  status varchar(32) NOT NULL,
  distance_meters integer,
  distance_source varchar(32),
  valid_point_count integer CHECK (valid_point_count >= 0),
  version integer NOT NULL CHECK (version > 0)
);
CREATE UNIQUE INDEX uq_open_trip_driver ON trips(driver_id)
  WHERE status IN ('ASSIGNED','ARRIVED_AT_PICKUP','PICKED_UP','IN_PROGRESS');
CREATE UNIQUE INDEX uq_open_trip_customer ON trips(customer_id)
  WHERE status IN ('ASSIGNED','ARRIVED_AT_PICKUP','PICKED_UP','IN_PROGRESS');
CREATE TABLE ratings (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL UNIQUE REFERENCES trips(id),
  customer_id uuid NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment varchar(500)
);
CREATE TABLE status_history (
  id uuid PRIMARY KEY,
  aggregate_type varchar(20) NOT NULL,
  aggregate_id uuid NOT NULL,
  from_status varchar(40),
  to_status varchar(40) NOT NULL,
  actor_id uuid,
  at timestamptz NOT NULL
);
CREATE TABLE idempotency_records (
  subject_id uuid NOT NULL,
  key uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  state varchar(12) NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  response jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, key)
);
CREATE TABLE processed_events (
  event_id uuid PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX ix_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;
```

Create RideRequest và ACCEPT đều gọi `pg_advisory_xact_lock(hashtextextended(customer_id::text,0))` trước khi kiểm tra cả RideRequest SEARCHING lẫn Trip mở. ACCEPT sau đó khóa hàng RideOffer/RideRequest, kiểm `status='PENDING' AND transaction_timestamp() < expires_at`, sao chép `customer_id` vào Trip; sai điều kiện trả 410 và không tạo Trip. Hai partial unique index theo customer chặn trùng trong từng bảng, còn advisory lock đóng race giữa hai bảng. Scheduler mỗi giây chỉ dọn hàng hết hạn bằng `WHERE status='PENDING' AND expires_at<=now() FOR UPDATE SKIP LOCKED`, không quyết định tính hợp lệ của ACCEPT. Elapsed điều phối lấy từ `ride_requests.search_started_at`, nên restart vẫn tiếp tục đúng mốc 160/180 giây. `idempotency_records` giữ response 24 giờ và được job dọn định kỳ.

Mọi query parameterized; DB role chỉ có quyền `cab_ride_db`. Dữ liệu ID không chứa secret; comment rating là user content, lưu nguyên văn và escape khi xuất HTML.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| RideRequest | `ride_requests` |
| RideOffer | `ride_offers`; scheduler dựa trên `expires_at` |
| Trip | `trips` |
| Rating | `ratings` |
| StatusHistory | `status_history` |

#### Bước 6. Ubiquitous Language

| Thuật ngữ | Định nghĩa | Ghi chú/Ví dụ |
| --- | --- | --- |
| RideRequest | Yêu cầu tìm tài xế của Customer. | Phiếu gọi Booking; trạng thái SEARCHING. |
| RideOffer | Lời mời một Driver cho RideRequest. | PENDING tối đa 20 giây. |
| Candidate | Driver đủ điều kiện tại một vòng. | Cùng loại xe, ≤5 km, location ≤60 giây. |
| Trip | Chuyến sau khi ACCEPT thắng. | Không gọi RideRequest là Trip trước ASSIGNED. |
| StatusHistory | Bản ghi append-only của chuyển trạng thái. | Một chuyển hợp lệ tạo đúng một dòng. |
| Rating | Điểm Customer cho Driver. | Phiếu gọi Review; score 1..5. |
| SEARCHING | RideRequest đang điều phối. | Hard stop giây 180. |
| ASSIGNED | Request/Trip đã có Driver. | Chỉ một winner. |
| ARRIVED_AT_PICKUP | Driver đã đến điểm đón. | Trước PICKED_UP nên còn hủy được. |
| PICKED_UP | Khách đã lên xe. | Sau mốc này xử lý hủy qua Incident. |
| IN_PROGRESS | Trip đang di chuyển. | Location hợp lệ được cộng distance. |
| COMPLETED | Trip hoàn tất. | Phát TripCompleted cho Billing. |
| CANCELLED | Tên chuẩn SRS cho đã hủy. | Alias phiếu: CANCELED. |

### BC-03 — Billing → `billing-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-03 sở hữu cả PriceVersion/Fare và Payment để không có Payment trước Fare hợp lệ, đồng thời giữ invariant một Payment/Trip và tối đa một PaymentAttempt SUCCEEDED. Pricing có thể tách khi có nhiều sản phẩm giá; pilot giữ chung.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-23–27, FR-40, FR-44, FR-54 | Quote, fare cuối, review, tiền mặt/sandbox và callback dedupe. |
| UC | UC-11, 11.2, 12.1–12.4, 16.4 | Tính/chốt Fare, thanh toán, đối soát và PriceVersion. |
| DEC/NFR | DEC-06–08, 22, 23, 27, 28; NFR-02, 08, 14 | Công thức giá, thiếu distance phải review, callback HMAC, UNKNOWN/retry. |
| Phiếu chấm | #19, #24–27, #29–30 | Thanh toán online/callback, mã hóa, injection/XSS/JWT/rate/replay. |

Mục tiêu: báo giá trước đặt; nhận `TripCompleted` để tạo Fare; chỉ cho thanh toán khi Fare FINALIZED; không sửa Payment từ Operations.

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> FINALIZED: distance hợp lệ
  PENDING --> FARE_REVIEW_REQUIRED: <2 điểm hợp lệ
  FARE_REVIEW_REQUIRED --> FINALIZED: OPERATOR verify distance
```

```mermaid
stateDiagram-v2
  [*] --> UNPAID
  UNPAID --> PENDING: create sandbox attempt
  PENDING --> SUCCEEDED: valid callback/cash confirm
  PENDING --> FAILED: final failure
  PENDING --> UNKNOWN: timeout
  FAILED --> PENDING: retry, tối đa 2
  UNKNOWN --> SUCCEEDED: reconciliation
  UNKNOWN --> FAILED: reconciliation
```

#### Bước 3. Microservice

- Service/database/container/port: `billing-service` / `cab_billing_db` / `billing-service` / 8083; health `/health`, readiness `/ready`.
- API sở hữu: API-18–API-23.
- Aggregate root: PriceVersion, Fare, Payment; PaymentAttempt là entity trong Payment aggregate.
- Phát: `FareFinalized.v1`, `FareReviewRequired.v1`, `PaymentStatusChanged.v1`, `AuditRecorded.v1`.
- Tiêu thụ: `TripCompleted.v1` để chốt Fare; payload có `distanceSource` và `validPointCount`, nhỏ hơn 2 điểm hợp lệ thì tạo FARE_REVIEW_REQUIRED thay vì amount. Quote/PriceVersion đã trả đồng bộ qua API-18 nên không tiêu thụ `RideRequested`.
- REST: Ride gọi estimate; Operations gọi Fare review. Callback API-23 không JWT, bắt buộc `X-Signature: sha256=<64 hex>` theo SRS §12.1.2.
- Contract kỹ thuật: service áp dụng DEC-34/IdempotencyRecord cục bộ và ENT-27 theo contract BC-01; OutboxEvent cục bộ theo contract ENT-24 của BC-05.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| Fare | ENT-08 | aggregate root | Cước duy nhất của Trip. |
| Payment | ENT-09 | aggregate root | Kết quả thanh toán duy nhất của Trip. |
| PaymentAttempt | ENT-14 | entity | Một lần thử sandbox của Payment. |
| PriceVersion | ENT-16 | aggregate root | Phiên bản biểu giá bất biến theo lịch sử. |

| Field | Kiểu logic | Bắt buộc (Y/N) | Duy nhất (Y/N) | Ràng buộc/Nguồn SRS |
| --- | --- | --- | --- | --- |
| Fare.id | id | Y | Y | ENT-08. |
| Fare.tripId | id | Y | Y | `ref → BC-02`; một Fare/Trip. |
| Fare.customerId | id | Y | N | Snapshot ownership từ TripCompleted; `ref → BC-01`. |
| Fare.driverId | id | Y | N | Snapshot ownership từ TripCompleted; `ref → BC-01`. |
| Fare.priceVersionId | id | Y | N | Tham chiếu PriceVersion đã quote. |
| Fare.distanceMeters | số nguyên | N | N | Không âm; null khi chờ review. |
| Fare.distanceSource | enum | N | N | GPS/OPERATOR_ESTIMATE. |
| Fare.amountVnd | tiền | N | N | Null khi FARE_REVIEW_REQUIRED. |
| Fare.status | enum | Y | N | PENDING/FARE_REVIEW_REQUIRED/FINALIZED. |
| Fare.version | số nguyên | Y | N | Optimistic concurrency. |
| Payment.id | id | Y | Y | ENT-09. |
| Payment.tripId | id | Y | Y | Một Payment/Trip. |
| Payment.customerId | id | Y | N | Sao chép từ Fare; dùng kiểm quyền API-21. |
| Payment.driverId | id | Y | N | Sao chép từ Fare; dùng kiểm quyền API-22. |
| Payment.amountVnd | tiền | Y | N | Số tiền Fare FINALIZED bất biến; dùng event doanh thu. |
| Payment.method | enum | Y | N | CASH/SANDBOX. |
| Payment.status | enum | Y | N | UNPAID→PENDING→SUCCEEDED/FAILED/UNKNOWN. |
| Payment.paidAt | thời điểm | N | N | Có khi thanh toán thành công. |
| Payment.version | số nguyên | Y | N | Optimistic concurrency. |
| PaymentAttempt.id | id | Y | Y | ENT-14. |
| PaymentAttempt.paymentId | id | Y | N | Thuộc Payment aggregate. |
| PaymentAttempt.scenario | enum | Y | N | DEC-27. |
| PaymentAttempt.providerRef | text(100) | N | Y | Duy nhất khi provider trả ref. |
| PaymentAttempt.status | enum | Y | N | Trạng thái lần thử. |
| PriceVersion.id | id | Y | Y | ENT-16. |
| PriceVersion.vehicleTypeId | id | Y | N | `ref → BC-01`. |
| PriceVersion.baseFareVnd | tiền | Y | N | Không âm. |
| PriceVersion.includedMeters | số nguyên | Y | N | Không âm. |
| PriceVersion.perKmVnd | tiền | Y | N | Không âm. |
| PriceVersion.effectiveAt | thời điểm | Y | N | Mốc bắt đầu hiệu lực. |
| PriceVersion.status | enum | Y | N | DRAFT→ACTIVE→RETIRED. |

Quan hệ: PriceVersion 1–N Fare; Fare 1–1 Trip logic; Trip logic 1–1 Payment; Payment 1–N PaymentAttempt. Invariant: PriceVersion của request không đổi; Fare FINALIZED bất biến; PENDING/UNKNOWN chặn attempt/phương thức mới; callback trùng không thu đôi; chỉ retry sau FAILED, tối đa hai lần.

```mermaid
erDiagram
  PriceVersion ||--o{ Fare : prices
  Fare ||--o| Payment : enables
  Payment ||--o{ PaymentAttempt : attempts
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Database `cab_billing_db`, user `cab_billing`. Fare/Payment 1–1 Trip, số tiền, version và callback cạnh tranh cần transaction/unique. Idempotency dùng bảng cục bộ; callback dedupe bằng `provider_events`, còn cập nhật Payment serialize bằng khóa hàng. Không service khác truy cập database này.

##### 5.2. Mô hình vật lý

`price_versions`, `fares`, `payments`, `payment_attempts`, `idempotency_records`, `provider_events`, `processed_events`, `outbox_events`. Unique `fares.trip_id`, `payments.trip_id`, `payment_attempts.provider_ref`; index `(payment_id,status)` và `(status,effective_at)`.

Mọi field logic ánh xạ sang cột `snake_case` cùng tên. `provider_events`, `processed_events`, `state` của idempotency và metadata retry/publish của outbox là cấu trúc kỹ thuật, không thay thế field nghiệp vụ.

```sql
CREATE TABLE price_versions (
  id uuid PRIMARY KEY,
  vehicle_type_id uuid NOT NULL,
  base_fare_vnd bigint NOT NULL CHECK (base_fare_vnd >= 0),
  included_meters integer NOT NULL CHECK (included_meters >= 0),
  per_km_vnd bigint NOT NULL CHECK (per_km_vnd >= 0),
  effective_at timestamptz NOT NULL,
  status varchar(12) NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED'))
);
CREATE TABLE fares (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  price_version_id uuid NOT NULL REFERENCES price_versions(id),
  distance_meters integer CHECK (distance_meters >= 0),
  distance_source varchar(32),
  amount_vnd bigint CHECK (amount_vnd >= 0),
  status varchar(24) NOT NULL CHECK (status IN ('PENDING','FARE_REVIEW_REQUIRED','FINALIZED')),
  version integer NOT NULL CHECK (version > 0)
);
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  amount_vnd bigint NOT NULL CHECK (amount_vnd >= 0),
  method varchar(12) NOT NULL CHECK (method IN ('CASH','SANDBOX')),
  status varchar(12) NOT NULL CHECK (status IN ('UNPAID','PENDING','SUCCEEDED','FAILED','UNKNOWN')),
  paid_at timestamptz,
  version integer NOT NULL CHECK (version > 0)
);
CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id),
  scenario varchar(32) NOT NULL,
  provider_ref varchar(100) UNIQUE,
  status varchar(12) NOT NULL
);
CREATE TABLE provider_events (
  provider_event_id varchar(100) PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id),
  payload_hash char(64) NOT NULL,
  received_at timestamptz NOT NULL
);
CREATE TABLE idempotency_records (
  subject_id uuid NOT NULL,
  key uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  state varchar(12) NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  response jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, key)
);
CREATE TABLE processed_events (
  event_id uuid PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX ix_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;
```

Billing sao chép `customerId/driverId` từ `TripCompleted` vào Fare rồi vào Payment; API-19 cho đúng Customer/Driver của Fare, API-21 chỉ Customer, API-22 chỉ Driver. Không gọi Ride đồng bộ để kiểm ownership. Callback insert `provider_events` trước; trùng PK trả kết quả đã có. Transaction khóa hàng Payment bằng `SELECT FOR UPDATE`, kiểm tra trạng thái rồi mới cập nhật PaymentAttempt/Payment và outbox. `idempotency_records` giữ thao tác review/cash/payment 24 giờ; job xóa bản hết hạn.

Fare demo với quãng đường 2.001 m: MOTORBIKE có base 10.000 VND gồm 2.000 m, phần vượt `1 m × 4.000/1.000 = 4 VND`, tổng 10.004 VND và làm tròn lên bội 1.000 thành 11.000 VND. CAR_4_SEAT có base 25.000 VND gồm 2.000 m, phần vượt `1 m × 10.000/1.000 = 10 VND`, tổng 25.010 VND và làm tròn lên thành 26.000 VND. Query dùng parameter binding; DB role riêng. CAB không lưu số thẻ/CVV/token provider. Callback secret ở secret store, không DB; log chỉ providerRef đã mask.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| PriceVersion | `price_versions` |
| Fare | `fares` |
| Payment | `payments` |
| PaymentAttempt | `payment_attempts`, `provider_events` |

#### Bước 6. Ubiquitous Language

| Thuật ngữ | Định nghĩa | Ghi chú/Ví dụ |
| --- | --- | --- |
| PriceVersion | Biểu giá có hiệu lực tại lúc đặt. | Chuyến cũ không đổi khi kích hoạt giá mới. |
| FareEstimate | Giá Haversine có nhãn ước tính. | Không phải Fare cuối. |
| Fare | Cước cuối của Trip. | FINALIZED hoặc FARE_REVIEW_REQUIRED. |
| Payment | Trạng thái thanh toán 1–1 Trip. | Phiếu gọi COMPLETED; chuẩn SRS là SUCCEEDED. |
| PaymentAttempt | Một lần gọi mock provider. | PENDING/UNKNOWN chặn attempt mới. |
| CASH | Phương thức tiền mặt. | Driver xác nhận sau Trip COMPLETED. |
| SANDBOX | Phương thức điện tử thử nghiệm. | Scenario SUCCESS/FAIL/TIMEOUT/DUPLICATE. |
| UNKNOWN | Chưa biết kết quả cuối. | Phải reconciliation, không tự retry/cash. |

### BC-04 — Notification → `notification-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-04 biến domain event thành inbox và SSE. Inbox là nguồn, SSE chỉ kênh hiển thị; vì cùng dedupe/checkpoint nên không tách thêm service.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-41, FR-56 | Ghi thông báo hủy/thay đổi và retry 1/5/25 giây. |
| UC | UC-13.1–13.3 | Consume event, stream SSE, đọc/đánh dấu inbox. |
| DEC/NFR | DEC-10, 37; NFR-02, 12, 17 | Lỗi Notification không rollback; 100 SSE, ≥95% ≤2 giây, DLQ. |
| Phiếu chấm | #16, #18, #22 | Driver/customer nhận offer, hủy và kết quả duyệt. |

```mermaid
flowchart LR
  Q[RabbitMQ event] --> D{eventId + recipientId đã có?}
  D -->|Có| A[Ack]
  D -->|Không| N[Create Notification]
  N --> S[Publish SSE nếu client online]
  S --> A
  N -->|lỗi| R[Retry 1s, 5s, 25s]
  R -->|vẫn lỗi| X[DLQ + log]
```

#### Bước 3. Microservice

- Service/database/container/port: `notification-service` / `cab_notification_db` / `notification-service` / 8084; `/health`, `/ready`.
- API sở hữu: API-24–API-26.
- Aggregate root: Notification.
- Phát: `AuditRecorded.v1` khi đánh dấu READ.
- Tiêu thụ: `DriverApplicationDecided.v1`, `RideRequested.v1`, `RideOfferCreated.v1`, `RideAssigned.v1`, `RideRequestCancelled.v1`, `RideRequestNoDriverFound.v1`, `TripStatusChanged.v1`, `FareFinalized.v1`, `FareReviewRequired.v1`, `PaymentStatusChanged.v1`, `IncidentResolved.v1`.
- Không gọi đồng bộ service nguồn; SSE payload chứa resource ID để client GET owner API xác nhận.
- CUSTOMER/DRIVER chỉ đọc recipientId bằng JWT `sub`.
- Contract kỹ thuật: service áp dụng DEC-34/IdempotencyRecord cục bộ và ENT-27 theo contract BC-01; OutboxEvent cục bộ theo contract ENT-24 của BC-05.

Web client dùng `fetch()` với header `Authorization: Bearer <accessToken>` và đọc `response.body` dạng stream; không dùng native `EventSource` vì API cần bearer header. Gateway giữ kết nối streaming, tắt response buffering/compression (`X-Accel-Buffering: no` nếu đứng sau Nginx), flush từng event/heartbeat 15 giây và đặt idle/read timeout tối đa 65 phút. Notification/Gateway tính `exp` của access JWT ngay khi mở kết nối và chủ động đóng stream không muộn hơn thời điểm đó; vì token sống 15 phút nên giới hạn proxy 65 phút không kéo dài phiên xác thực. Khi stream đóng do token hết hạn hoặc mạng đứt, client dùng refresh token, mở lại bằng access token mới với `Last-Event-ID`, rồi GET resource nguồn để xác nhận.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| Notification | ENT-10 | aggregate root | Inbox idempotent theo recipientId+eventId. |

| Field | Kiểu logic | Bắt buộc (Y/N) | Duy nhất (Y/N) | Ràng buộc/Nguồn SRS |
| --- | --- | --- | --- | --- |
| id | id | Y | Y | ID thông báo. |
| recipientId | id | Y | cặp với eventId | `ref → BC-01`; actor sở hữu. |
| eventId | id | Y | cặp với recipientId | Dedupe at-least-once. |
| type | text(64) | Y | N | Loại domain event cho client. |
| readAt | thời điểm | N | N | null=CREATED, có giá trị=READ. |
| resource | JSON | Y | N | Snapshot tối thiểu để client định tuyến tới resource nguồn. |
| createdAt | thời điểm | Y | N | Cursor SSE/inbox, do server tạo. |

Quan hệ logic: một recipient có nhiều Notification; event có tối đa một Notification/recipient. Invariant: chỉ CREATED→READ, không unread; lỗi ghi/SSE không đảo giao dịch nguồn; Last-Event-ID chỉ checkpoint delivery, không thay đổi nghiệp vụ.

```mermaid
erDiagram
  RecipientRef ||--o{ Notification : receives
  EventRef ||--o{ Notification : materializes
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Database `cab_notification_db`, user `cab_notification`. Dedupe `(recipientId,eventId)`, chuyển READ một chiều và phân trang ổn định cần unique/index; `resource` linh hoạt lưu `jsonb`. SSE connection registry giữ trong bộ nhớ tiến trình, còn reconnect dùng Last-Event-ID đọc lại bản ghi bền vững.

##### 5.2. Mô hình vật lý

Mỗi field logic của Notification ánh xạ trực tiếp sang cột `snake_case` cùng tên; không có cột nghiệp vụ ẩn hoặc bị lược bỏ.

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL,
  event_id uuid NOT NULL,
  type varchar(64) NOT NULL,
  resource jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  read_at timestamptz,
  UNIQUE (recipient_id, event_id)
);
CREATE INDEX ix_notifications_inbox
  ON notifications(recipient_id, created_at DESC, id DESC);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
CREATE INDEX ix_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;
INSERT INTO notifications(id,recipient_id,event_id,type,resource,created_at,read_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003','RideOfferCreated',
        '{"rideOfferId":"550e8400-e29b-41d4-a716-446655440004","expiresAt":"2026-09-29T09:15:20+07:00"}',
        '2026-09-29T09:15:00+07:00',NULL);
```

Cursor `(createdAt,id)`, `size≤100`; không xóa inbox theo TTL vì retention production chưa chốt. Registry SSE nằm trong bộ nhớ notification-service. Last-Event-ID ánh xạ tới cursor và query các hàng mới hơn. Query dùng parameter binding/allow-list sort; nội dung resource trả JSON, web client escape text và CSP chặn inline script.

Notification không cần bảng `processed_events` riêng: `UNIQUE(recipient_id,event_id)` chính là khóa dedupe side effect của từng consumer-recipient; insert trùng được ack mà không phát SSE lần hai.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| Notification | bảng `notifications`; connection SSE chỉ là trạng thái bộ nhớ tiến trình |

#### Bước 6. Ubiquitous Language

| Thuật ngữ | Định nghĩa | Ghi chú/Ví dụ |
| --- | --- | --- |
| Notification | Bản ghi inbox bền vững. | Nguồn theo DEC-10, không phải SSE packet. |
| Recipient | User nhận thông báo. | recipientId từ JWT sub. |
| CREATED | Thông báo chưa đọc. | readAt null. |
| READ | Thông báo đã đọc. | API-25 chỉ chuyển một chiều. |
| SSE Event | Bản trình chiếu realtime của Notification. | `id/event/data`, reconnect bằng Last-Event-ID. |
| Dead-letter | Event không xử lý được sau ba lần retry. | Phải log và có thao tác replay. |

### BC-05 — Operations & Reporting → `operations-reporting-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-05 sở hữu Incident/Audit và read projection. Reporting có thể tách khi tải phân tích tăng; pilot giữ chung vì cả hai consume cùng event, không sửa aggregate nguồn và phục vụ cùng nhóm vận hành.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-31–38, FR-42, FR-46, FR-52, FR-55 | Quyền vận hành, incident/audit, active trip projection và báo cáo. |
| UC | UC-16.1, 16.7, 17.1–17.3, 18.1–18.2 | Tra cứu, phát hiện/xử lý sự cố, báo cáo. |
| DEC/NFR | DEC-01, 11, 12, 14, 15, 21, 31, 32; NFR-08, 09, 13, 15 | DB riêng, outbox/audit, timezone/formula, incident treo, backup. |
| Phiếu chấm | #3–8, #11–13, #22, #24–30 | Accountable health contract, giám sát, audit và bằng chứng bảo mật. |

```mermaid
stateDiagram-v2
  [*] --> OPEN: actor report or system threshold exceeded
  OPEN --> IN_PROGRESS: OPERATOR accepts
  IN_PROGRESS --> RESOLVED: choose resolution
  RESOLVED --> CLOSED: verify downstream result
  IN_PROGRESS --> CLOSED: no domain change needed
```

#### Bước 3. Microservice

- Service/database/container/port: `operations-reporting-service` / `cab_operations_db` / `operations-reporting-service` / 8085; `/health`, `/ready`.
- API sở hữu: API-27–API-30; quản trị contract API-X01–X03, thực thi health ở Gateway.
- Aggregate root: Incident, ReportProjection; AuditLog append-only.
- Phát: `IncidentResolved.v1`, `AuditRecorded.v1`. Lệnh kết thúc Trip/Fare review đi REST, không phát command event.
- Tiêu thụ: `DriverLocationUpdated.v1`, `DriverApplicationDecided.v1`, `RideRequested.v1`, `RideOfferCreated.v1`, `RideOfferResponded.v1`, `RideAssigned.v1`, `RideRequestCancelled.v1`, `RideRequestNoDriverFound.v1`, `TripStatusChanged.v1`, `TripCompleted.v1`, `RatingCreated.v1`, `FareFinalized.v1`, `FareReviewRequired.v1`, `PaymentStatusChanged.v1`, `AuditRecorded.v1` để dựng audit/projection và đủ fact cho công thức báo cáo.
- REST: gửi command có Idempotency-Key tới Ride/Billing; không cập nhật database của chúng.
- Contract kỹ thuật: service áp dụng DEC-34/IdempotencyRecord cục bộ và ENT-27 theo contract BC-01; BC-05 quản trị ENT-24 và triển khai OutboxEvent cục bộ.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| AuditRecord | ENT-12 | value event | Payload audit đã mask do service nguồn phát. |
| AuditLog | ENT-17 | entity append-only | Bản ghi Operations nhận idempotent. |
| Incident | ENT-18 | aggregate root | Sự cố actor hoặc hệ thống tạo. |
| OutboxEvent | ENT-24 | entity kỹ thuật chuẩn | Contract outbox; instance cục bộ ở từng service. |
| ReportProjection | ENT-28 | aggregate root/read model | Metric theo ngày và dimensions. |

| Field | Kiểu logic | Bắt buộc (Y/N) | Duy nhất (Y/N) | Ràng buộc/Nguồn SRS |
| --- | --- | --- | --- | --- |
| AuditRecord.id | id | Y | Y | ENT-12. |
| AuditRecord.eventId | id | Y | Y | ID event nguồn. |
| AuditRecord.actorId | id | N | N | `ref → BC-01`; null cho SYSTEM. |
| AuditRecord.action | text(80) | Y | N | Hành động nghiệp vụ. |
| AuditRecord.targetId | id | Y | N | Aggregate bị tác động. |
| AuditRecord.beforeAfter | JSON | N | N | Diff đã mask tại nguồn. |
| AuditLog.id | id | Y | Y | ENT-17. |
| AuditLog.auditRecordId | id | Y | Y | Dedupe AuditRecord. |
| AuditLog.traceId | text(64) | Y | N | Correlation xuyên service. |
| AuditLog.occurredAt | thời điểm | Y | N | Append-only. |
| Incident.id | id | Y | Y | ENT-18. |
| Incident.tripId | id | Y | N | `ref → BC-02`. |
| Incident.customerId | id | Y | N | Snapshot từ active Trip projection để định tuyến thông báo. |
| Incident.driverId | id | Y | N | Snapshot từ active Trip projection để định tuyến thông báo. |
| Incident.source | enum | Y | N | CUSTOMER/DRIVER/OPERATOR/SYSTEM. |
| Incident.reason | text(500) | Y | N | Lý do tạo sự cố. |
| Incident.status | enum | Y | N | OPEN→IN_PROGRESS→RESOLVED→CLOSED. |
| Incident.resolution | enum | N | N | Có khi xử lý. |
| Incident.version | số nguyên | Y | N | Optimistic concurrency. |
| OutboxEvent.id | id | Y | Y | ENT-24. |
| OutboxEvent.aggregateId | id | Y | N | Aggregate nguồn. |
| OutboxEvent.eventType | text(100) | Y | N | Tên event có version. |
| OutboxEvent.payload | JSON | Y | N | Contract event. |
| OutboxEvent.occurredAt | thời điểm | Y | N | Thời điểm nghiệp vụ. |
| OutboxEvent.publishedAt | thời điểm | N | N | Null trước khi publish. |
| ReportProjection.metricDate | ngày | Y | N | Asia/Ho_Chi_Minh. |
| ReportProjection.dimensions | JSON | Y | N | Các chiều báo cáo. |
| ReportProjection.metrics | JSON | Y | N | Delta/fact do đúng một source event tạo ra, chưa phải tổng hợp cuối. |
| ReportProjection.sourceEventId | id | Y | Y | Một projection/source event; rebuild được. |

Quan hệ: TripRef 1–N Incident; AuditRecord 1–1 AuditLog; một source Event tạo đúng một ReportProjection chứa toàn bộ dimensions/metrics liên quan. Invariant: một Incident SYSTEM cho mỗi trip/type/ngưỡng; đúng 30 phút chưa tạo, 30:00.001 mới tạo; resolution không sửa Payment; consumer audit/projection idempotent.

```mermaid
erDiagram
  TripRef ||--o{ Incident : has
  AuditRecord ||--|| AuditLog : materializes
  SourceEventRef ||--|| ReportProjection : updates
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Database `cab_operations_db`, user `cab_operations`. Incident theo version, audit append-only và consumer dedupe cần transaction/unique; dimensions/metrics dùng `jsonb`, báo cáo theo kỳ dùng index ngày. Service không dùng cache ngoài tiến trình và không truy cập database khác.

##### 5.2. Mô hình vật lý

`incidents`, `audit_logs`, `report_projections`, `active_trip_projections`, `processed_events`, `outbox_events`. Scheduler chống trùng Incident SYSTEM bằng idempotency key suy ra từ `(trip_id, threshold_type)` trong `processed_events`; unique `audit_record_id`, `source_event_id`; index `(status,created_at)`, GIN dimensions, `(metric_date)`.

Mọi field Incident, AuditLog và ReportProjection ánh xạ sang cột `snake_case` cùng tên, ngoại trừ `Incident.reason` được tách thành ba cột mã hóa nêu dưới. `AuditRecord` là payload nguồn: `id` ánh xạ `audit_record_id`, còn `eventId/actorId/action/targetId/beforeAfter` nằm trong `masked_record`; `OutboxEvent` ánh xạ trực tiếp vào `outbox_events`. `report_projections` là bảng fact một dòng/source event: `dimensions` chứa ngày/vehicleType và `metrics` chứa delta như `offerAccepted=1`; API báo cáo mới `SUM`/group các fact tại lúc query. `active_trip_projections`, `processed_events`, `created_at` của Incident và metadata retry/publish của outbox là cấu trúc kỹ thuật vật lý.

```sql
CREATE TABLE incidents (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  source varchar(12) NOT NULL CHECK (source IN ('CUSTOMER','DRIVER','OPERATOR','SYSTEM')),
  reason_ciphertext bytea NOT NULL,
  reason_nonce bytea NOT NULL,
  reason_key_version text NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  resolution varchar(24),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  audit_record_id uuid NOT NULL UNIQUE,
  trace_id varchar(64) NOT NULL,
  occurred_at timestamptz NOT NULL,
  masked_record jsonb NOT NULL
);
CREATE TABLE report_projections (
  metric_date date NOT NULL,
  dimensions jsonb NOT NULL,
  metrics jsonb NOT NULL,
  source_event_id uuid PRIMARY KEY
);
CREATE TABLE active_trip_projections (
  trip_id uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  status varchar(32) NOT NULL,
  assigned_at timestamptz NOT NULL,
  status_changed_at timestamptz NOT NULL,
  last_event_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0)
);
CREATE TABLE processed_events (
  event_id uuid PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz
);
```

Reason/beforeAfter có thể chứa dữ liệu cá nhân: validate/mask tại nguồn; `Incident.reason` ánh xạ thành `reason_ciphertext/reason_nonce/reason_key_version` dùng AES-256-GCM và khóa pilot được truyền cho Operations qua Compose. Không ghi token/phone đầy đủ. Query báo cáo dùng binding, allow-list `groupBy`, kỳ tối đa 366 ngày; DB role read/write đúng schema này.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| Incident | `incidents` |
| AuditRecord/AuditLog | payload event → `audit_logs` |
| OutboxEvent | `outbox_events` cục bộ trong từng database; contract do BC-05 quản trị |
| ReportProjection | `report_projections`, `active_trip_projections`, `processed_events` |

#### Bước 6. Ubiquitous Language

| Thuật ngữ | Định nghĩa | Ghi chú/Ví dụ |
| --- | --- | --- |
| Incident | Hồ sơ xử lý sự cố Trip. | OPEN→IN_PROGRESS→RESOLVED→CLOSED. |
| SYSTEM Incident | Sự cố do scheduler phát hiện. | ASSIGNED quá 30 phút chỉ tạo một bản. |
| Resolution | Kết quả xử lý. | CONTINUE_TRIP/CANCEL_TRIP/TERMINATE_TRIP/FARE_REVIEW. |
| AuditRecord | Event audit đã mask từ owner. | Không ghi trực tiếp database Operations. |
| AuditLog | Bản lưu append-only của AuditRecord. | Dedupe bằng auditRecordId. |
| ReportProjection | Fact một dòng/source event, chứa dimensions và metric delta. | Rebuild được; báo cáo tổng hợp bằng SUM/group khi query và trả asOf. |
| Revenue | Tổng Fare của Trip hoàn thành đã thanh toán. | Theo paidAt, Asia/Ho_Chi_Minh. |
| Acceptance Rate | ACCEPTED/(ACCEPTED+DECLINED+EXPIRED). | Không tính CANCELLED; mẫu số 0 trả null. |
| Find-driver Rate | ASSIGNED/(ASSIGNED+NO_DRIVER_FOUND). | Khác completion rate. |

## Phần III. Tổng hợp xuyên hệ thống

### III.1. BC → Microservice → database → API → UC

| BC | Microservice | Database | API sở hữu | UC sở hữu | Số entity |
| --- | --- | --- | --- | --- | ---: |
| BC-01 Identity & Driver | `identity-driver-service` | `cab_identity_db` (PostgreSQL) | API-01–10; API-X04–06, X08–12 | UC-01.1, 01.2, 02, 03.1, 03.2, 04, 08, 16.2, 16.3, 16.5, 16.6 | 14* |
| BC-02 Ride | `ride-service` | `cab_ride_db` (PostgreSQL) | API-11–17; API-X07 | UC-05.1, 05.2, 06.1–06.3, 07.1–07.2, 09.1–09.2, 10, 14, 15 | 5 |
| BC-03 Billing | `billing-service` | `cab_billing_db` (PostgreSQL) | API-18–23 | UC-11, 11.2, 12.1–12.4, 16.4 | 4 |
| BC-04 Notification | `notification-service` | `cab_notification_db` (PostgreSQL) | API-24–26 | UC-13.1–13.3 | 1 |
| BC-05 Operations & Reporting | `operations-reporting-service` | `cab_operations_db` (PostgreSQL) | API-27–30; API-X01–03 | UC-16.1, 16.7, 17.1–17.3, 18.1–18.2 | 5 |

`*` BC-01 có 13 entity chuẩn trong SRS và một entity `OtpChallenge` gắn `⚠ Giả định`. Số BC = số microservice nghiệp vụ = số database `cab_*_db` = 5; năm database nằm trên một container PostgreSQL. RabbitMQ là broker, không phải database nghiệp vụ.

### III.2. Hợp đồng event

Đây là bảng event chuẩn duy nhất; bảng queue ở 0.7 là ánh xạ vận chuyển của từng cặp event–consumer.

| Event v1 | Producer | Consumer → queue | Payload chính | Khóa/dedupe | Xử lý lỗi |
| --- | --- | --- | --- | --- | --- |
| `DriverApplicationDecided.v1` | BC-01 | BC-04 → `identity.notification`; BC-05 → `identity.operations` | eventId, applicationId, driverId, status, version | eventId | retry/DLQ từng queue |
| `DriverLocationUpdated.v1` | BC-01 | BC-02 → `identity.ride-location`; BC-05 → `identity.operations` | eventId, driverId, lat, lng, receivedAt, tripId; chỉ phát khi tripId khác null | eventId; driverId+receivedAt | Bỏ event cũ; retry/DLQ |
| `RideRequested.v1` | BC-02 | BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, rideRequestId, vehicleTypeId, pickup, occurredAt | eventId | retry/DLQ |
| `RideOfferCreated.v1` | BC-02 | BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, offerId, rideRequestId, driverId, expiresAt | eventId+recipientId | retry/DLQ từng queue |
| `RideOfferResponded.v1` | BC-02 | BC-05 → `ride.operations` | eventId, offerId, rideRequestId, driverId, outcome, occurredAt | eventId; offerId+outcome | Fact ACCEPTED/DECLINED/EXPIRED; retry/DLQ |
| `RideAssigned.v1` | BC-02 | BC-01 → `ride.identity-state`; BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, tripId, customerId, driverId, version | eventId; tripId+version | retry/DLQ |
| `RideRequestCancelled.v1` | BC-02 | BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, rideRequestId, customerId, affectedDriverIds, actorId, version | eventId; aggregate+version | Notification gửi Customer và driver còn offer PENDING; retry/DLQ |
| `RideRequestNoDriverFound.v1` | BC-02 | BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, rideRequestId, customerId, occurredAt, reason | eventId; rideRequestId+NO_DRIVER_FOUND | Thông báo một lần; retry/DLQ |
| `TripStatusChanged.v1` | BC-02 | BC-01 → `ride.identity-state`; BC-04 → `ride.notification`; BC-05 → `ride.operations` | eventId, tripId, customerId, driverId, from, to, version, occurredAt | eventId; tripId+version | Bỏ version cũ; Notification không lookup owner; retry/DLQ |
| `TripCompleted.v1` | BC-02 | BC-03 → `ride.billing`; BC-05 → `ride.operations` | eventId, tripId, customerId, driverId, vehicleTypeId, priceVersionId, distanceMeters, distanceSource, validPointCount, version | eventId; tripId+version | Billing lưu ownership và dùng validPointCount để quyết định review; retry/DLQ |
| `RatingCreated.v1` | BC-02 | BC-01 → `ride.identity-state`; BC-05 → `ride.operations` | eventId, ratingId, tripId, driverId, score | eventId | BC-01 cập nhật average idempotent; retry/DLQ |
| `FareFinalized.v1` | BC-03 | BC-04 → `billing.notification`; BC-05 → `billing.operations` | eventId, fareId, tripId, customerId, driverId, amountVnd, status, version | eventId; fareId+version | Notification định tuyến trực tiếp; retry/DLQ |
| `FareReviewRequired.v1` | BC-03 | BC-04 → `billing.notification`; BC-05 → `billing.operations` | eventId, fareId, tripId, customerId, driverId, reason, version | eventId; fareId+version | Notification định tuyến trực tiếp; retry/DLQ |
| `PaymentStatusChanged.v1` | BC-03 | BC-04 → `billing.notification`; BC-05 → `billing.operations` | eventId, paymentId, attemptId, tripId, customerId, driverId, amountVnd, status, paidAt | eventId; attemptId+status | Revenue lấy amountVnd khi SUCCEEDED; không downgrade; retry/DLQ |
| `IncidentResolved.v1` | BC-05 | BC-04 → `operations.notification` | eventId, incidentId, tripId, customerId, driverId, resolution, version | eventId; incidentId+version | Notification định tuyến trực tiếp; retry 1/5/25 giây rồi DLQ |
| `AuditRecorded.v1` | BC-01–05 | BC-05 → `operations.audit` | eventId, actorId, action, targetId, occurredAt, maskedDiff | eventId | retry/DLQ; append-only |

### III.3. Ranh giới giao dịch và xử lý thất bại

- Trong service: aggregate + StatusHistory/outbox/idempotency record commit cùng transaction. Giữa service: RabbitMQ at-least-once, eventual consistency, không distributed transaction.
- Offer hết hạn: transaction ACCEPT tự khóa offer/request và chỉ hợp lệ khi `transaction_timestamp() < expires_at`; tại hoặc sau `expires_at` trả 410 dù scheduler chưa quét. Scheduler mỗi giây chỉ cleanup các hàng `status='PENDING' AND expires_at<=now()` bằng `FOR UPDATE SKIP LOCKED`, chuyển EXPIRED, phát event và chọn vòng mới. Vì vậy scheduler trễ tối đa khoảng một giây không kéo dài cửa sổ ACCEPT.
- Callback thanh toán trễ: providerEventId dedupe; UNKNOWN giữ chặn; callback SUCCEEDED đến sau timeout được áp dụng một lần. Payment đã SUCCEEDED không bị downgrade.
- Driver hủy sau nhận: trước PICKED_UP Trip→CANCELLED, không tự matching lại; từ PICKED_UP dùng Incident, có thể TERMINATED_BY_INCIDENT và Fare review.
- Notification/Billing down không rollback RideRequest; outbox tồn và publisher gửi lại sau phục hồi.

### III.4. Sở hữu và truy vết duy nhất

| BC | ENT sở hữu |
| --- | --- |
| BC-01 | ENT-01, ENT-02, ENT-03, ENT-04, ENT-07, ENT-19, ENT-20, ENT-21, ENT-22, ENT-23, ENT-25, ENT-26, ENT-27 |
| BC-02 | ENT-05, ENT-06, ENT-11, ENT-13, ENT-15 |
| BC-03 | ENT-08, ENT-09, ENT-14, ENT-16 |
| BC-04 | ENT-10 |
| BC-05 | ENT-12, ENT-17, ENT-18, ENT-24, ENT-28 |

| BC | FR sở hữu |
| --- | --- |
| BC-01 | FR-01–06, FR-21, FR-43, FR-45, FR-47, FR-49–51 |
| BC-02 | FR-07–20, FR-22, FR-28–30, FR-39, FR-48, FR-53 |
| BC-03 | FR-23–27, FR-40, FR-44, FR-54 |
| BC-04 | FR-41, FR-56 |
| BC-05 | FR-31–38, FR-42, FR-46, FR-52, FR-55 |

| BC | UC sở hữu |
| --- | --- |
| BC-01 | UC-01.1, UC-01.2, UC-02, UC-03.1, UC-03.2, UC-04, UC-08, UC-16.2, UC-16.3, UC-16.5, UC-16.6 |
| BC-02 | UC-05.1, UC-05.2, UC-06.1, UC-06.2, UC-06.3, UC-07.1, UC-07.2, UC-09.1, UC-09.2, UC-10, UC-14, UC-15 |
| BC-03 | UC-11, UC-11.2, UC-12.1, UC-12.2, UC-12.3, UC-12.4, UC-16.4 |
| BC-04 | UC-13.1, UC-13.2, UC-13.3 |
| BC-05 | UC-16.1, UC-16.7, UC-17.1, UC-17.2, UC-17.3, UC-18.1, UC-18.2 |

| BC | DEC sở hữu |
| --- | --- |
| BC-01 | DEC-02, DEC-09, DEC-18, DEC-25, DEC-26, DEC-29, DEC-30, DEC-33, DEC-34, DEC-35, DEC-38 |
| BC-02 | DEC-03, DEC-04, DEC-05, DEC-13, DEC-16, DEC-17, DEC-19, DEC-20, DEC-24, DEC-36 |
| BC-03 | DEC-06, DEC-07, DEC-08, DEC-22, DEC-23, DEC-27, DEC-28 |
| BC-04 | DEC-10, DEC-37 |
| BC-05 | DEC-01, DEC-11, DEC-12, DEC-14, DEC-15, DEC-21, DEC-31, DEC-32 |

| BC | API baseline sở hữu |
| --- | --- |
| BC-01 | API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10 |
| BC-02 | API-11, API-12, API-13, API-14, API-15, API-16, API-17 |
| BC-03 | API-18, API-19, API-20, API-21, API-22, API-23 |
| BC-04 | API-24, API-25, API-26 |
| BC-05 | API-27, API-28, API-29, API-30 |

ENT-23/24 là mẫu kỹ thuật được triển khai cục bộ ở nhiều service, nhưng để đáp ứng quy tắc một chủ contract: BC-01 quản trị schema IdempotencyRecord, BC-05 quản trị schema OutboxEvent. ENT-27 là contract do BC-01 quản trị; Gateway giữ bộ đếm trong bộ nhớ và không có bảng vật lý. Gateway vẫn không trở thành BC và không có aggregate nghiệp vụ.

### III.5. Thuật ngữ xuyên context dễ nhầm

| Thuật ngữ | Ý nghĩa ở từng BC | Cách dùng thống nhất |
| --- | --- | --- |
| status | BC-01 có User.status, DriverApplication.status và Availability.status; BC-02 có RideRequest/Trip/RideOffer.status; BC-03 có Fare/Payment.status; BC-05 có Incident.status. | Luôn kèm tên aggregate; không truyền một enum status chung xuyên context. |
| Driver | BC-01 sở hữu DriverProfile; BC-02 dùng Candidate khi matching và giữ driver snapshot trong Trip. | `driverId` là tham chiếu; Candidate/snapshot không phải bản sao aggregate DriverProfile. |
| Fare / FareEstimate / quotedFareVnd | BC-03 sở hữu Fare cuối và tính FareEstimate; BC-02 chỉ giữ quotedFareVnd cùng priceVersionId trên RideRequest. | Dùng FareEstimate trước đặt, quotedFareVnd là snapshot báo giá, Fare là cước cuối. |
| Review | BC-02 có Rating cho chuyến; BC-03 có Fare review do OPERATOR xác minh distance/cước. | Gọi rõ Rating hoặc Fare review; không tạo entity Review chung. |
| Notification / SSE event | BC-04 lưu Notification inbox từ domain event; SSE là kênh giao bản tin tới client. | Notification là nguồn bền vững; SSE event không phải aggregate hoặc domain event mới. |
| Trip / RideRequest | BC-02 tạo RideRequest lúc bắt đầu tìm xe và chỉ tạo Trip khi một offer ACCEPT thắng. | Không dùng Trip cho giai đoạn SEARCHING và không gọi RideRequest là chuyến đã gán. |
| Audit | Service owner phát AuditRecord đã mask; BC-05 lưu AuditLog append-only. | Không ghi trực tiếp chéo database Operations; phân biệt payload event với bản lưu. |

## Phần IV. Bảo mật xuyên hệ thống

### IV.1. Xác thực và token

Identity phát access JWT ký `RS256`, hạn 15 phút; claim tối thiểu `sub`, `role`, `iss=cab-identity`, `aud=cab-api`, `iat`, `exp`, `jti`. Refresh token opaque 30 ngày, xoay mỗi lần dùng và chỉ lưu hash. Gateway và service kiểm chữ ký bằng public key, không chấp nhận `alg=none`. Khi khóa User, Identity thu hồi toàn bộ refresh token; access token đã phát có thể còn hiệu lực tối đa 15 phút. `⚠ Giả định`: SRS chưa chốt thuật toán/TTL và chấp nhận cửa sổ access tối đa 15 phút này ở pilot; muốn thu hồi tức thời phải bổ sung denylist/introspection ngoài phạm vi hiện tại.

### IV.2. Đe dọa và lớp chặn — Phiếu #24–30

| Phiếu | Đe dọa | Lớp chặn/cơ chế | HTTP | Ví dụ Postman |
| ---: | --- | --- | ---: | --- |
| 24 | Đọc trực tiếp DB | Argon2id cho password; AES-256-GCM + nonce/keyVersion cho phone/name/plate; khóa ngoài DB; blind index HMAC. | 200 API nhưng DB chỉ thấy ciphertext/hash | Đăng ký password `CabPilot2026`, sau đó truy vấn DB qua test fixture xác nhận không có plaintext. |
| 25 | SQL injection | JSON schema, parameter binding/ORM, allow-list sort/filter và user database tối thiểu; không nối chuỗi SQL. | 400/401 | POST `/api/v1/auth/login` body `{"phone":"' OR 1=1 --","password":"anything"}` → 400/401. |
| 26 | Stored/reflected XSS | Lưu comment/reason như text; JSON encoder; UI escape; CSP `default-src 'self'`, `script-src 'self'`; `X-Content-Type-Options: nosniff`. | 201/200, script không chạy | POST rating comment `<script>alert('hack')</script>`; GET trả escaped/render như text. |
| 27 | JWT tampering | RS256 signature, issuer/audience/expiry; bỏ tin header role từ client. | 401 | Sửa `sub/role` trong `$customerToken`, GET `/api/v1/operations/trips/active` → 401. |
| 28 | Sai role/ownership | Gateway allow-list + service policy mặc định deny; query luôn scope theo `sub`. | 403 | CUSTOMER PUT `/api/v1/drivers/me/availability` → 403, không dữ liệu. |
| 29 | Flood/rate attack | Gateway một instance đếm cửa sổ trong bộ nhớ theo IP/user. DEC-30: login 10/phút/IP, RideRequest 5/phút/user, location 12/phút/driver, chung 100/phút/user; trả `Retry-After`. | 429 | Gửi lần RideRequest thứ 6 trong phút → 429; restart Gateway làm mất cửa sổ hiện tại, là đánh đổi pilot. |
| 30 | Replay/double charge | `Idempotency-Key` UUID, subject+key, payload SHA-256, state IN_PROGRESS/COMPLETED, TTL 24h; cùng payload trả response cũ, khác payload 409. Provider event dedupe. | status cũ/409 | Gửi API-21 hai lần với key `550e8400-e29b-41d4-a716-446655440099` → cùng paymentId, một attempt. |

Request đang xử lý giữ record `IN_PROGRESS`; request trùng trả 409 `IDEMPOTENCY_IN_PROGRESS` và `Retry-After: 1`, không chạy song song. Khi hoàn tất lưu status/body cũ. Secret scan, dependency scan và log scan chạy CI; log bắt buộc correlationId nhưng không token/password/phone đầy đủ.

### IV.3. Ma trận quyền rút gọn

| Role | Nhóm API cho phép | Nhóm bị 403 |
| --- | --- | --- |
| Public | API-01, 02, 03, 04, X08, X09; API-04 xác thực bằng refresh token, API-23 dùng HMAC | Mọi API JWT khác |
| CUSTOMER | API-05, 11, 12, 15–19, 21, 24–26, 28, X07 theo ownership | Driver availability/location; Operations/Admin |
| DRIVER | API-05–07, 13–16, 19, 22, 24–26, 28 theo assignment | Tạo RideRequest/payment customer; Operations |
| OPERATOR | API-09,10,20,27–30, X04–06, X10–12 | API-08 tạo user nội bộ; dữ liệu ngoài permission |
| ADMIN | API-08, API-30 | Tự cấp ADMIN khác; sửa Payment/Trip trực tiếp |
| EXECUTIVE | API-30 | Dữ liệu vị trí cá nhân và API thay đổi trạng thái |

## Phần V. Kịch bản smoke test và dữ liệu giả lập

### V.1. Seed data

| Driver | ID | Tọa độ/trạng thái | Khoảng cách xấp xỉ từ pickup 10.776889,106.700806 | Kỳ vọng query 1 km |
| --- | --- | --- | ---: | --- |
| Trần Văn Bình | `10000000-0000-4000-8000-000000000001` | 10.777200,106.700900; ONLINE; MOTORBIKE | 36 m | Có |
| Lê Minh Châu | `10000000-0000-4000-8000-000000000002` | 10.780000,106.704000; ONLINE; MOTORBIKE | 489 m | Có |
| Phạm Quốc Dũng | `10000000-0000-4000-8000-000000000003` | 10.784000,106.708000; ONLINE; MOTORBIKE | 1.110 m | Không |
| Võ Thu Hà | `10000000-0000-4000-8000-000000000004` | 10.777000,106.701000; OFFLINE; MOTORBIKE | 24 m | Không |
| Nguyễn Gia Huy | `10000000-0000-4000-8000-000000000005` | 10.778000,106.702000; ON_TRIP; CAR_4_SEAT | 179 m | Không |

History Customer `20000000-0000-4000-8000-000000000001`, phone `+84901111111`, có ba RideRequest seed: một SEARCHING, một NO_DRIVER_FOUND và một CANCELLED; chỉ request SEARCHING là mở. Active-Trip Customer `20000000-0000-4000-8000-000000000002`, phone `+84902222222`, có một RideRequest ASSIGNED gắn một Trip IN_PROGRESS với tài xế Nguyễn Gia Huy, cùng một RideRequest ASSIGNED cũ có Trip COMPLETED. Như vậy tổng vẫn có năm RideRequest mẫu nhưng không Customer nào đồng thời có request SEARCHING và Trip mở; trạng thái ON_TRIP của Huy có Trip tương ứng. Customer của chuỗi đăng ký/đặt xe dùng phone chưa seed `+84901234567`, nên API-01 trả 201 và ban đầu không có request/trip mở. Seed bằng migration idempotent `infra/seed/seed-pilot`; script seed tính Argon2id lúc chạy từ password demo `CabPilot2026`, không commit sẵn chuỗi hash hoặc secret sản xuất.

OTP `123456` chỉ cố định khi `APP_ENV` là `local`/`test` và `OTP_DELIVERY_MODE=fixed`; adapter vẫn lưu duy nhất hash trong `otp_challenges` và ghi mã vào test harness thay vì gửi SMS. Identity phải từ chối khởi động nếu mode `fixed` xuất hiện ở staging/production. Các môi trường khác dùng adapter phát mã ngẫu nhiên và không log plaintext.

### V.2. Chuỗi Postman chính

1. `POST /auth/register` bằng phone `+84901234567`, lưu `customerId`; `POST /auth/login`, lưu `newCustomerToken`. Đăng nhập riêng History Customer `+84901111111` để lưu `historyCustomerToken` cho API-X07.
2. API-X08 yêu cầu OTP; Postman Test lưu ID do server sinh bằng `pm.environment.set("otpChallengeId", pm.response.json().id)`; API-X09 gửi `{"challengeId":"{{otpChallengeId}}","otp":"123456"}`. Sau đó API-02 tạo hồ sơ; OPERATOR API-X10–X12 duyệt; DRIVER API-06 bật ONLINE và API-07 gửi vị trí.
3. Dùng `$newCustomerToken`: API-18 tính Haversine cho cặp tọa độ phiếu #15 xấp xỉ 770 m, nên quote MOTORBIKE là 10.000 VND trong 2.000 m mở cửa; API-11 tạo RideRequest với Idempotency-Key và lưu `rideRequestId`. Ví dụ 2.001 m → 11.000 VND ở BC-03 chỉ minh họa điểm nhảy công thức, không phải khoảng cách của tọa độ này.
4. Driver nhận SSE API-26, API-13 ACCEPT trước 20 giây; lưu `tripId`; Customer API-16 thấy driver nhưng không thấy phone.
5. Driver gọi API-14 lần lượt ARRIVED_AT_PICKUP → PICKED_UP → IN_PROGRESS → COMPLETED, xen API-07 location; assertion version tăng và không bỏ mốc.
6. Customer API-21 chọn `TIMEOUT_THEN_SUCCESS`, mock callback API-23 ký HMAC; assertion Payment SUCCEEDED một lần.
7. Customer API-17 score 5/comment; gọi lần hai cùng Trip với key khác phải 409 vì một Rating/Trip.
8. Chạy negative collection #24–30 và health #6; dùng Postman Runner để lặp rate test.

Biến environment: `gatewayBaseUrl=http://localhost:8080` cho `/health`, `/ready`; `apiBaseUrl={{gatewayBaseUrl}}/api/v1` cho API nghiệp vụ; `newCustomerToken`, `historyCustomerToken`, `driverToken`, `operatorToken`, `adminToken`, `customerId`, `historyCustomerId`, `driverId`, `otpChallengeId`, `rideRequestId`, `offerId`, `tripId`, `fareId`, `paymentId`, `notificationId`, `incidentId`, `idempotencyKey`. Phân trang chuẩn API baseline dùng `page` mặc định 1, `size` mặc định 20/tối đa 100; API-X06 dùng cursor vì dữ liệu vị trí thay đổi nhanh.

## Phần VI. Ma trận phiếu chấm — 30 mục

| STT | Nội dung | Thành phần/BC | API/cơ chế và ví dụ Postman/kiểm chứng | Kết quả mong đợi | Mục tài liệu | Trạng thái |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Tổ chức source | Monorepo/5 BC | GET `/health`, body none; kiểm cây `services/*/src/{api,application,domain,infrastructure}` | 5 service tự chứa migration/test | 0.1 | Hạ tầng |
| 2 | `.gitignore`/`.env` | Repo/CI | GET `/health`, body none; `git ls-files .env` rỗng, `.env.example` tồn tại | Không secret thật | 0.2 | Hạ tầng |
| 3 | Gateway | API Gateway | GET `/health`, body none | routing/auth/rate/correlation hoạt động | 0.3 | Hạ tầng |
| 4 | IPC | 5 BC/RabbitMQ | POST `/ride-requests` body pickup/destination cụ thể ở #15 | REST candidate + async offer event | 0.4 | Hạ tầng |
| 5 | Compose/container | Docker | GET `/health`, body none; `docker compose ps` | Đủ 8 container, chỉ Gateway publish | 0.5 | Hạ tầng |
| 6 | Health | Gateway/BC-05 | GET `/health`, GET `/ready`, GET `/health/services`, body none | 200 healthy/ready; 503 degraded khi service down | 0.6 | API bổ sung X01–03 |
| 7 | Broker | RabbitMQ | POST `/ride-requests`; xem queue `ride.notification` | Event được ack hoặc DLQ đúng retry | 0.7 | Hạ tầng |
| 8 | Mọi request qua Gateway | Gateway | GET `http://localhost:8080/health`; thử `localhost:8081/health` | Gateway 200, port service không kết nối | 0.3/0.5 | Hạ tầng |
| 9 | Đăng ký Customer | BC-01 | POST `/auth/register` `{"phone":"+84901234567","password":"CabPilot2026","fullName":"Nguyễn Minh An"}` | 201 User CUSTOMER ACTIVE; login được | BC-01/API-01 | API có sẵn |
| 10 | Đăng nhập | BC-01 | POST `/auth/login` `{"phone":"+84901234567","password":"CabPilot2026"}` | 200 access/refresh token | BC-01/API-03 | API có sẵn |
| 11 | Xem Customer theo mã | BC-01 | GET `/operations/customers/20000000-0000-4000-8000-000000000001`, Bearer `$operatorToken` | 200, phone đã mask; sai quyền 403 | BC-01/API-X04 | API bổ sung |
| 12 | Xem Driver theo mã | BC-01 | GET `/operations/drivers/10000000-0000-4000-8000-000000000001` | 200 profile/vehicle/availability, không lộ tài liệu thô | BC-01/API-X05 | API bổ sung |
| 13 | Driver quanh tọa độ | BC-01 | GET `/operations/drivers/nearby?lat=10.776889&lng=106.700806&radiusMeters=1000&limit=20` | Chỉ hai driver ONLINE hợp lệ trong 1 km, có nextCursor | BC-01 §5.2/API-X06 | API bổ sung |
| 14 | Booking của Customer | BC-02 | Bearer `$historyCustomerToken`; GET `/ride-requests?customerId=me&page=1&size=20` | 200, đúng 3 seed của History Customer, metadata page/size/total | BC-02/API-X07 | API bổ sung |
| 15 | Đặt xe | BC-02 | POST `/ride-requests` `{"pickup":{"lat":10.776889,"lng":106.700806},"destination":{"lat":10.781234,"lng":106.695321},"vehicleTypeId":"550e8400-e29b-41d4-a716-446655440010"}` | 201 SEARCHING, `quotedFareVnd=10000`, tạo offer tối đa 20 giây | API-11,18 | API có sẵn |
| 16 | Driver nhận chuyến | BC-02/04 | POST `/ride-offers/{offerId}/responses` `{"decision":"ACCEPT","version":1}` | 200 ACCEPTED, một Trip ASSIGNED; Customer nhận driver snapshot | API-13,16,26 | API có sẵn |
| 17 | Cập nhật Trip | BC-02/01 | PUT `/trips/{tripId}/status` lần lượt với `ARRIVED_AT_PICKUP`, `PICKED_UP`, `IN_PROGRESS`, `COMPLETED`, version tăng | 200 từng bước; bỏ bước trả 409/422 | API-07,14 | API có sẵn |
| 18 | Hủy Trip | BC-02/04 | POST `/trips/{tripId}/cancellation` `{"reason":"Đổi kế hoạch","version":2}` | 200 `CANCELLED`; hai bên có Notification | API-15,24–26 | API có sẵn |
| 19 | Thanh toán online | BC-03 | POST `/trips/{tripId}/payments` `{"method":"SANDBOX","sandboxScenario":"SUCCESS"}` rồi POST callback HMAC | 201 PENDING → 200 SUCCEEDED; không double charge | API-21,23 | API có sẵn |
| 20 | Đánh giá | BC-02 | POST `/trips/{tripId}/ratings` `{"score":5,"comment":"Tài xế lịch sự"}` | 201 Rating gắn Trip; lần hai 409 | API-17 | API có sẵn |
| 21 | Đăng ký Driver OTP | BC-01 | POST OTP request `{"phone":"+84909876543"}`, lưu response `id` vào `otpChallengeId`, verify `{"challengeId":"{{otpChallengeId}}","otp":"123456"}`, rồi API-02 | 201 DriverApplication PENDING_REVIEW | API-X08/X09, API-02 | API bổ sung + có sẵn |
| 22 | Duyệt Driver | BC-01/04 | PATCH `/operations/driver-applications/{id}` `{"decision":"APPROVE","version":1}` | 200 APPROVED; Driver nhận Notification | API-X10–12, API-24 | API bổ sung |
| 23 | Online/Offline | BC-01 | PUT `/drivers/me/availability` `{"status":"ONLINE","version":1}` | 200 ONLINE; không đủ điều kiện 409/422 | API-06 | API có sẵn |
| 24 | Encryption at rest | Mọi DB/BC-01 chính | POST API-01 rồi kiểm fixture DB không có `CabPilot2026`/phone plaintext | Chỉ Argon2id/ciphertext/nonce/keyVersion | Phần IV/BC-01 §5.2 | Cơ chế bảo mật |
| 25 | Injection | Gateway/service | POST `/auth/login` `{"phone":"' OR 1=1 --","password":"anything"}` | 400/401, không bypass/lộ DB | IV.2 | Cơ chế bảo mật |
| 26 | XSS | BC-02/web | POST rating comment `<script>alert('hack')</script>` rồi GET Trip/Rating projection | Chuỗi là text, không execute; CSP/escape | IV.2 | Cơ chế bảo mật |
| 27 | JWT tampering | Gateway/service | Sửa payload `$customerToken`, GET `/operations/trips/active` | 401 signature invalid | IV.1–2 | Cơ chế bảo mật |
| 28 | Unauthorized | Gateway/BC-01 | CUSTOMER PUT `/drivers/me/availability` `{"status":"ONLINE","version":1}` | 403, không thay đổi dữ liệu | IV.3 | Cơ chế bảo mật |
| 29 | Rate limit | Gateway memory | Lặp POST `/ride-requests` sáu lần/phút cùng Customer | Lần 6 trả 429 + Retry-After; hệ thống không sập | IV.2/DEC-30 | Cơ chế bảo mật |
| 30 | Replay | Mọi write API/BC-03 | Lặp POST `/trips/{tripId}/payments` cùng Idempotency-Key/body; sau đó cùng key/body khác | Trả paymentId cũ; body khác 409; một attempt | IV.2/DEC-34 | Cơ chế bảo mật |

## Phần VII. Đối chiếu thuật ngữ phiếu chấm ↔ SRS

| Phiếu chấm | Tên chuẩn SRS/code | Quy tắc sử dụng |
| --- | --- | --- |
| Booking | RideRequest | UI có thể ghi “đặt xe”; API/entity giữ `RideRequest`. |
| Ride/Trip | Trip | Chỉ tạo sau offer ACCEPT thắng; trước đó là RideRequest. |
| Offer | RideOffer | Giữ enum PENDING/ACCEPTED/DECLINED/EXPIRED/CANCELLED. |
| `CANCELED` | `CANCELLED` | Giữ chính tả SRS trong API/database. |
| Payment `COMPLETED` | Payment `SUCCEEDED` | UI có thể hiển thị “hoàn tất”; contract giữ SUCCEEDED. |
| Review | Rating | Phiếu #20 tương ứng ENT-11 Rating, không phải Fare review. |
| Admin duyệt driver | OPERATOR duyệt DriverApplication | SRS phân quyền OPERATOR; ADMIN chỉ tạo user nội bộ/báo cáo. |
| Driver status | User.status / DriverApplication.status / Availability.status | Không gộp; ONLINE thuộc Availability. |
| 1 km nearby | API-X06 truy vấn kiểm thử | Matching nghiệp vụ vẫn bán kính 5 km theo DEC-03. |

## Phần VIII. Giả định và điểm SRS còn thiếu

### VIII.1. Danh sách `⚠ Giả định`

1. API-X01–X03: health của Gateway/service; BC-05 chịu trách nhiệm contract nhưng Gateway thực thi.
2. API-X04/X05: OPERATOR tra cứu Customer/Driver theo mã để đáp ứng phiếu #11/#12.
3. API-X06: danh sách Driver trong bán kính 1 km, `limit≤100`, cursor `(distanceMeters,driverId)`; không thay bán kính matching 5 km.
4. API-X07: danh sách RideRequest của Customer, page/size theo BC-12.
5. API-X08/X09: OTP đăng ký Driver sống 5 phút, tối đa 5 lần thử, lưu hash; API-02 nhận `otpVerificationId`.
6. API-X10–X12: list/detail/decision DriverApplication; actor chuẩn là OPERATOR dù phiếu gọi Admin.
7. JWT dùng RS256, access 15 phút, refresh opaque 30 ngày; khi khóa User, refresh bị thu hồi nhưng access đã phát có thể sống tối đa 15 phút. SRS chưa chốt thuật toán, TTL hay yêu cầu thu hồi tức thời; pilot chấp nhận đánh đổi này.
8. ENT-23, ENT-24 là pattern cục bộ nhiều service nhưng cần một chủ schema để ma trận không trùng; lần lượt BC-01 và BC-05 quản trị contract. ENT-27 là contract BC-01, còn Gateway giữ bộ đếm trong bộ nhớ và không tạo bảng vật lý.
9. Bốn field snapshot tên hiển thị, biển số, loại xe và rating của tài xế được bổ sung vào Trip tại thời điểm ACCEPT để API-16 không phụ thuộc BC-01 khi đọc; SRS cho phép Customer xem thông tin này nhưng chưa khai báo chúng là field ENT-06.
10. Queue `ride.billing` dùng cùng timeline retry 1/5/25 giây và DLQ như DEC-37; replay giữ nguyên `eventId`.
11. Chu kỳ kỹ thuật của job pilot là 250 ms/1 phút/1 giờ/30 giây theo bảng 0.8 và có thể cấu hình; các ngưỡng nghiệp vụ trong SRS không thay đổi.

### VIII.2. API bổ sung cần cập nhật SRS

Khi chấp nhận một API-X làm public contract, phải cập nhật đồng thời SRS §12.1 và `api_document/_manifest.yaml`; sau đó mới tái sinh/validate OpenAPI để tránh hai nguồn lệch nhau.

| Mã | Method/path | Owner | Lý do |
| --- | --- | --- | --- |
| API-X01 | GET `/health` | BC-05/Gateway | Phiếu #6 liveness. |
| API-X02 | GET `/ready` | BC-05/Gateway | Phiếu #6 readiness. |
| API-X03 | GET `/health/services` | BC-05/Gateway | Phiếu #6 aggregate health. |
| API-X04 | GET `/api/v1/operations/customers/{id}` | BC-01 | Phiếu #11. |
| API-X05 | GET `/api/v1/operations/drivers/{id}` | BC-01 | Phiếu #12. |
| API-X06 | GET `/api/v1/operations/drivers/nearby` | BC-01 | Phiếu #13. |
| API-X07 | GET `/api/v1/ride-requests` | BC-02 | Phiếu #14/UC-14. |
| API-X08 | POST `/api/v1/auth/driver-registrations/otp-requests` | BC-01 | Phiếu #21. |
| API-X09 | POST `/api/v1/auth/driver-registrations/otp-verifications` | BC-01 | Phiếu #21. |
| API-X10 | GET `/api/v1/operations/driver-applications` | BC-01 | Phiếu #22. |
| API-X11 | GET `/api/v1/operations/driver-applications/{id}` | BC-01 | Phiếu #22. |
| API-X12 | PATCH `/api/v1/operations/driver-applications/{id}` | BC-01 | Phiếu #22. |

### VIII.3. Mâu thuẫn/thiếu cần tác giả SRS xử lý

- Phiếu #22 nói ADMIN duyệt tài xế; SRS DEC-02/UC-16.2 quy định OPERATOR. Thiết kế ưu tiên SRS và coi “Admin” trong phiếu là tên gọi chung giao diện vận hành.
- Phiếu dùng Payment COMPLETED và Trip CANCELED; SRS dùng Payment SUCCEEDED và Trip CANCELLED. Không tạo enum alias trong persistence.
- Phiếu yêu cầu endpoint 1 km, trong khi matching SRS dùng 5 km. API-X06 là query kiểm thử/vận hành 1 km; thuật toán điều phối vẫn 5 km.
- Phiếu minh họa password “mã hóa”; thiết kế dùng hash Argon2id cho password vì không cần giải mã, đúng DEC-29; chỉ field cần đọc lại mới dùng AES-256-GCM.
- SRS chưa có OTP, endpoint đọc Customer/Driver theo ID, booking list, driver application list/detail/decision và health API; cần bổ sung 12 API-X đồng thời vào SRS §12.1 và `api_document/_manifest.yaml` nếu giảng viên coi chúng là public contract.
