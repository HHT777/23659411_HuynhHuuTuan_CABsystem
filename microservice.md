# CAB System — DDD Bounded Context → Microservice

## 0. Mục tiêu, phạm vi và nguồn

Tài liệu chuyển baseline CAB System thành kiến trúc triển khai microservice cho đồ án 7 tuần. Nguồn chuẩn là SRS §3, §7–§12; `api_document/_manifest.yaml`; và 30 tiêu chí trong `phieucham.md`. Khi phiếu chấm dùng thuật ngữ khác SRS, tài liệu giữ tên SRS trong code/data và chỉ ghi alias ở Phần VII.

Quy tắc chốt: một Bounded Context (BC) bằng một microservice và một database riêng; API Gateway và RabbitMQ là hạ tầng, không phải BC; Redis chỉ lưu dữ liệu tạm/hot, không là nguồn sự thật. Mỗi mã ENT, FR, UC, DEC và API có một chủ sở hữu duy nhất trong ma trận Phần III.

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

  ID -->|Driver eligibility/location REST; DriverLocationUpdated| R
  R -->|TripCompleted; Fare query ACL| B
  R -->|Ride/Offer/Trip events| N
  B -->|FareFinalized; PaymentStatusChanged| N
  ID -->|AuditRecorded| O
  R -->|AuditRecorded; TripStatusChanged| O
  B -->|AuditRecorded; payment projection| O
  N -->|delivery metrics| O
  O -->|IncidentResolved command/event| R
  O -->|Fare review command| B
```

Identity & Driver cung cấp Open Host Service cho xác thực và điều kiện tài xế. Ride là customer của dữ liệu vị trí nhưng không đọc database Identity. Billing là downstream conformist với `TripCompleted`. Notification và Operations dùng Published Language qua RabbitMQ; Operations dùng Anti-Corruption Layer khi phát lệnh kết thúc Trip hoặc review Fare.

### I.3. Quy tắc tích hợp

- REST đồng bộ chỉ dùng khi request hiện tại cần kết quả ngay; timeout 800 ms, tối đa một retry có jitter cho GET idempotent, circuit breaker mở sau 5 lỗi/10 giây và thử lại sau 30 giây.
- Thay đổi nghiệp vụ phát event bằng transactional outbox; consumer dedupe theo `eventId`, xử lý at-least-once và không ghi chéo database.
- Mọi message có `eventId`, `eventType`, `aggregateId`, `version`, `occurredAt`, `correlationId`, `payload`.
- Nhất quán mạnh chỉ nằm trong một service. Notification/reporting nhất quán cuối cùng; API của owner là nguồn xác nhận trạng thái.

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
| `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` | `/run/secrets/jwt_private.pem`, `/run/secrets/jwt_public.pem` | Identity ký; Gateway/service kiểm chữ ký |
| `FIELD_ENCRYPTION_KEY`, `FIELD_KEY_VERSION` | `base64-demo-not-a-real-key`, `v1` | Identity & Driver |
| `IDENTITY_DB_URL` | `postgresql://cab_identity:demo@identity-db:5432/cab_identity_db` | Identity & Driver |
| `RIDE_DB_URL` | `postgresql://cab_ride:demo@ride-db:5432/cab_ride_db` | Ride |
| `BILLING_DB_URL` | `postgresql://cab_billing:demo@billing-db:5432/cab_billing_db` | Billing |
| `NOTIFICATION_DB_URL` | `mongodb://cab_notification:demo@notification-db:27017/cab_notification_db` | Notification |
| `OPERATIONS_DB_URL` | `postgresql://cab_operations:demo@operations-db:5432/cab_operations_db` | Operations & Reporting |
| `REDIS_URL` | `redis://redis:6379/0` | Gateway và service theo namespace |
| `RABBITMQ_URL` | `amqp://cab:demo@rabbitmq:5672/cab` | Mọi service |
| `PAYMENT_CALLBACK_SECRET` | `demo-rotate-before-use` | Billing mock adapter |
| `INTERNAL_SERVICE_TOKEN` | `demo-internal-token` | REST nội bộ trong pilot |

CI phải kiểm tra `.env` không được Git track, `.env.example` có mặt, secret scan không báo khóa thật. Nếu secret từng bị commit: thu hồi/xoay khóa ngay, cập nhật secret store, xóa khỏi lịch sử bằng `git filter-repo`, force-push có phối hợp và buộc đăng nhập lại; chỉ xóa file ở commit mới là chưa đủ.

### 0.3. API Gateway — Phiếu #3 và #8

| Trách nhiệm | Cách thực hiện |
| --- | --- |
| Routing | Route `/api/v1` theo bảng dưới; không chứa business logic. |
| JWT | Kiểm chữ ký bất đối xứng, `exp`, `iss`, `aud`; gắn `sub`, `role` đã xác thực vào header nội bộ có ký. |
| Phân quyền thô | Chặn role không thuộc allow-list; service vẫn kiểm ownership và rule. |
| Rate limit | Redis sliding/fixed window theo DEC-30; trả 429 và `Retry-After`. |
| Correlation | Nhận hoặc sinh UUID `X-Correlation-Id`, truyền qua REST/message/log. |
| Biên HTTP | Body tối đa 1 MiB, JSON UTF-8, CORS allow-list ba web app, TLS ≥1.2. |
| Health facade | Thực thi `/health`, `/ready`, gom `/health/services` song song. |

| Prefix | Đích | Auth/role |
| --- | --- | --- |
| `/api/v1/auth`, `/api/v1/me/profile`, `/api/v1/drivers`, `/api/v1/operations/accounts`, `/api/v1/operations/internal-users` | `identity-driver-service:8081` | Register/login public; callback OTP public có challenge; còn lại JWT theo manifest. |
| `/api/v1/ride-requests`, `/api/v1/ride-offers`, `/api/v1/trips/*/status`, `/api/v1/trips/*/cancellation`, `/api/v1/trips/*/ratings` | `ride-service:8082` | CUSTOMER/DRIVER theo API. |
| `/api/v1/fare-estimates`, `/api/v1/fares`, `/api/v1/trips/*/fare`, `/api/v1/trips/*/payments`, `/api/v1/payments` | `billing-service:8083` | JWT; riêng provider callback dùng HMAC. |
| `/api/v1/notifications`, `/api/v1/me/events` | `notification-service:8084` | CUSTOMER/DRIVER. |
| `/api/v1/operations/trips`, `/api/v1/operations/incidents`, `/api/v1/reports`, `/api/v1/trips/*/incidents` | `operations-reporting-service:8085` | OPERATOR/ADMIN/EXECUTIVE hoặc actor Trip theo manifest. |

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
| Ride → Identity & Driver | REST GET nội bộ | Lấy tối đa 3 ứng viên mỗi vòng theo vị trí/vehicle; cần ngay để mở offer. | 800 ms; 1 retry GET; circuit breaker; lỗi coi vòng hiện tại chưa có ứng viên. |
| Ride → Billing | REST POST nội bộ fare estimate hoặc event | Estimate cần ngay; Fare cuối dùng `TripCompleted`. | 800 ms cho estimate; event retry/DLQ cho Fare. |
| Operations → Ride/Billing | REST command có idempotency | Kết thúc Trip do incident hoặc xác minh Fare cần phản hồi ngay cho OPERATOR. | 1.5 s; không tự retry POST nếu thiếu cùng Idempotency-Key. |
| Identity/Ride/Billing → Notification | RabbitMQ | Thông báo không được rollback giao dịch nguồn. | Retry 1/5/25 giây, rồi DLQ theo DEC-37. |
| Tất cả → Operations | RabbitMQ | Audit/projection không chặn request nguồn. | Outbox, consumer idempotent, DLQ. |

REST nội bộ dùng service token ngắn hạn trong mạng riêng; production thay bằng mTLS. Không tin role do client gửi. `X-Correlation-Id` được truyền nguyên vẹn vào message.

```mermaid
sequenceDiagram
  participant C as Customer
  participant G as Gateway
  participant R as Ride
  participant I as IdentityDriver
  participant Q as RabbitMQ
  participant N as Notification
  C->>G: POST /ride-requests
  G->>R: JWT + Idempotency-Key
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
| `api-gateway` | `./gateway` | entry point | 8080 | `8080:8080` | Redis + 5 service ready | không |
| `identity-driver-service` | build service | BC-01 | 8081 | — | identity-db, Redis, RabbitMQ | không |
| `ride-service` | build service | BC-02 | 8082 | — | ride-db, Redis, RabbitMQ | không |
| `billing-service` | build service | BC-03 | 8083 | — | billing-db, Redis, RabbitMQ | không |
| `notification-service` | build service | BC-04 | 8084 | — | notification-db, Redis, RabbitMQ | không |
| `operations-reporting-service` | build service | BC-05 | 8085 | — | operations-db, RabbitMQ | không |
| `identity-db` | `postgres:16` | `cab_identity_db` | 5432 | — | `pg_isready` | `identity-data` |
| `ride-db` | `postgres:16` | `cab_ride_db` | 5432 | — | `pg_isready` | `ride-data` |
| `billing-db` | `postgres:16` | `cab_billing_db` | 5432 | — | `pg_isready` | `billing-data` |
| `notification-db` | `mongo:7` | `cab_notification_db` | 27017 | — | `mongosh --eval ping` | `notification-data` |
| `operations-db` | `postgres:16` | `cab_operations_db` | 5432 | — | `pg_isready` | `operations-data` |
| `redis` | `redis:7-alpine` | rate limit, GEO, TTL | 6379 | — | `redis-cli ping` | `redis-data` |
| `rabbitmq` | `rabbitmq:3-management` | broker + management nội bộ | 5672/15672 | — | `rabbitmq-diagnostics ping` | `rabbitmq-data` |

Tổng: 13 container = 1 Gateway + 5 service + 5 database + Redis + RabbitMQ.

```yaml
services:
  api-gateway:
    build: ./gateway
    ports: ["8080:8080"]
    networks: [cab-internal]
    depends_on:
      redis: { condition: service_healthy }
      identity-driver-service: { condition: service_healthy }
  identity-driver-service:
    build: ./services/identity-driver-service
    expose: ["8081"]
    networks: [cab-internal]
    depends_on:
      identity-db: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
  ride-service:
    build: ./services/ride-service
    expose: ["8082"]
    networks: [cab-internal]
  billing-service:
    build: ./services/billing-service
    expose: ["8083"]
    networks: [cab-internal]
  notification-service:
    build: ./services/notification-service
    expose: ["8084"]
    networks: [cab-internal]
  operations-reporting-service:
    build: ./services/operations-reporting-service
    expose: ["8085"]
    networks: [cab-internal]
  identity-db: { image: "postgres:16", expose: ["5432"], networks: [cab-internal] }
  ride-db: { image: "postgres:16", expose: ["5432"], networks: [cab-internal] }
  billing-db: { image: "postgres:16", expose: ["5432"], networks: [cab-internal] }
  notification-db: { image: "mongo:7", expose: ["27017"], networks: [cab-internal] }
  operations-db: { image: "postgres:16", expose: ["5432"], networks: [cab-internal] }
  redis: { image: "redis:7-alpine", expose: ["6379"], networks: [cab-internal] }
  rabbitmq: { image: "rabbitmq:3-management", expose: ["5672", "15672"], networks: [cab-internal] }
networks: { cab-internal: { driver: bridge } }
```

Khởi động và kiểm tra: `docker compose up -d`, `docker compose ps`, sau đó chạy collection `postman/CAB-smoke.postman_collection.json` qua Gateway.

### 0.6. Health check — Phiếu #6

| Mã | Endpoint | Ý nghĩa |
| --- | --- | --- |
| API-X01 | `GET /health` | Liveness Gateway; không gọi phụ thuộc; 200 `{"status":"healthy"}`. |
| API-X02 | `GET /ready` | Gateway kết nối Redis/RabbitMQ và route bắt buộc; 200 ready hoặc 503 not_ready. |
| API-X03 | `GET /health/services` | Gateway gọi song song `/health` và `/ready` nội bộ của 5 service, timeout 300 ms/service, tổng timeout 500 ms. |

`⚠ Giả định (bổ sung theo phiếu chấm)`: API-X01–X03 được gán trách nhiệm quản trị contract cho BC-05, nhưng thực thi tại Gateway vì Gateway không phải BC.

```json
{"status":"ready","services":{"identity-driver":{"status":"ready","latencyMs":12},"ride":{"status":"ready","latencyMs":18},"billing":{"status":"ready","latencyMs":15},"notification":{"status":"ready","latencyMs":21},"operations-reporting":{"status":"ready","latencyMs":17}}}
```

Khi Billing down, endpoint trả HTTP 503: `{"status":"degraded","services":{"billing":{"status":"down","latencyMs":300}}}`; các lời gọi khác vẫn hoàn tất song song nên một service không kéo dài quá tổng timeout.

### 0.7. Message broker — Phiếu #7

Chọn **RabbitMQ**: luồng pilot cần routing theo loại event, acknowledgement, retry theo khoảng 1/5/25 giây và DLQ; quy mô nhỏ, không yêu cầu replay lịch sử dài. Không chọn Kafka vì vận hành partition/KRaft và retention log nặng hơn nhu cầu 7 tuần; thứ tự cần thiết đã được bảo vệ bằng aggregate version và một queue theo consumer.

| Exchange/queue | Producer | Consumer | Routing key | TTL/retention | DLQ |
| --- | --- | --- | --- | --- | --- |
| `cab.domain` / `ride.notification` | Ride | Notification | `ride.*`, `offer.*`, `trip.*` | durable đến ack | `ride.notification.dlq` |
| `cab.domain` / `billing.notification` | Billing | Notification | `fare.*`, `payment.*` | durable đến ack | `billing.notification.dlq` |
| `cab.audit` / `operations.audit` | Mọi service | Operations | `audit.recorded` | 7 ngày pilot | `operations.audit.dlq` |
| `cab.domain` / `operations.projection` | Ride/Billing | Operations | `trip.*`, `payment.*` | 7 ngày pilot | `operations.projection.dlq` |
| `cab.command` / `ride.incident` | Operations | Ride | `trip.terminate` | 24 giờ | `ride.command.dlq` |

Kiểm tra broker: `docker compose exec rabbitmq rabbitmq-diagnostics ping` và `rabbitmqctl list_queues name messages_ready messages_unacknowledged`. Management UI chỉ mở qua `docker compose exec`/SSH tunnel, không publish host. Khi tạo RideRequest, outbox publisher phải làm tăng message/consumer log của `RideRequested`; consumer lưu `eventId` trước side effect. Notification retry bằng delay queue 1/5/25 giây rồi DLQ theo DEC-37.

## Phần II. Thiết kế từng Bounded Context

### BC-01 — Identity & Driver → `identity-driver-service`

#### Bước 1. Tóm tắt xác định và phân rã

BC-01 sở hữu danh tính, hồ sơ và điều kiện hoạt động của tài xế. Có thể tách Identity khỏi Driver Location khi quy mô tăng, nhưng pilot giữ chung vì invariant ONLINE cần đồng thời User ACTIVE, DriverApplication APPROVED, Vehicle ACTIVE, không Trip/offer mở và vị trí mới. Kết luận chi tiết ở Phần I.

#### Bước 2. Business Design

| Nhóm | Mã sở hữu | Hệ quả thiết kế |
| --- | --- | --- |
| FR | FR-01–06, FR-21, FR-43, FR-45, FR-47, FR-49–51 | Phone duy nhất; hồ sơ/xe hợp lệ; vị trí mới hơn thắng; khóa phiên; bảo mật/rate limit. |
| UC | UC-01.1, 01.2, 02, 03.1, 03.2, 04, 08, 16.2, 16.3, 16.5, 16.6 | Bao phủ đăng ký, đăng nhập, hồ sơ, availability, location và quản trị tài khoản. |
| DEC/NFR | DEC-02, 09, 18, 25, 26, 29, 30, 33, 35, 38; NFR-04–07, 09, 16 | Một phone/một role; 5 lần sai khóa 15 phút; location >300 giây tự OFFLINE; TLS/log masking. |
| Phiếu chấm | #9–13, #21–23, #24–29 | Account/driver smoke test, GEO 1 km, OTP/duyệt, availability và bảo mật. |

Mục tiêu trong luồng: tạo actor hợp lệ trước đặt xe; cung cấp candidate/driver snapshot cho Ride; không quyết định ACCEPT hoặc Trip.

```mermaid
stateDiagram-v2
  [*] --> PENDING_REVIEW: driver registration + OTP verified
  PENDING_REVIEW --> APPROVED: OPERATOR approve
  PENDING_REVIEW --> REJECTED: OPERATOR reject
  APPROVED --> OFFLINE: activate profile and vehicle
  OFFLINE --> ONLINE: eligibility valid
  ONLINE --> ON_TRIP: Ride assigned
  ON_TRIP --> ONLINE: Trip ended and driver opts online
  ONLINE --> OFFLINE: driver toggles or location age >300s
```

#### Bước 3. Microservice

- Service/database/container/port: `identity-driver-service` / `cab_identity_db` / `identity-driver-service` / 8081.
- Health nội bộ: `GET /health`, `GET /ready`.
- API sở hữu: API-01–API-10.
- Aggregate root: `User`, `DriverApplication`, `Vehicle`, `Availability`, `DriverLocation`.
- Phát: `UserRegistered`, `AccountLocked`, `DriverApplicationDecided`, `AvailabilityChanged`, `DriverLocationUpdated`, `AuditRecorded` (mọi event có version).
- Tiêu thụ: `RideAssigned`, `TripStatusChanged` để đổi Availability; không sửa Trip.
- REST ra ngoài: Ride internal query candidate/driver snapshot gọi vào BC này; BC này không gọi database khác.
- Quyền: Public cho API-01/02/03; Authenticated cho API-04; CUSTOMER/DRIVER cho API-05; DRIVER cho API-06/07; ADMIN API-08; OPERATOR API-09/10.

API bổ sung theo phiếu chấm:

| Mã | Method/path | Role | Mục đích |
| --- | --- | --- | --- |
| API-X04 | `GET /api/v1/operations/customers/{id}` | OPERATOR | Phiếu #11, xem Customer theo mã. |
| API-X05 | `GET /api/v1/operations/drivers/{id}` | OPERATOR | Phiếu #12, xem Driver theo mã. |
| API-X06 | `GET /api/v1/operations/drivers/nearby?lat=10.776889&lng=106.700806&radiusMeters=1000&limit=20&cursor=...` | OPERATOR | Phiếu #13, driver trong 1 km, limit/cursor. |
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

| Entity.Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/độ nhạy cảm |
| --- | --- | --- | --- | --- |
| User.id / phone | id / E.164(15) | Y/Y | Y/Y | phone `SENSITIVE-ENCRYPT`, blind index để unique. |
| User.passwordHash | text(255) | Y | N | `SENSITIVE-HASH`; không bao giờ trả API. |
| User.roles / status / mustChangePassword | set<Role> / enum / boolean | Y/Y/Y | N | Một role pilot; PENDING→ACTIVE↔LOCKED→DISABLED. |
| CustomerProfile.userId / fullName / createdAt | id / text(120) / thời điểm | Y/Y/Y | Y/N/N | userId logical 1–1; fullName `SENSITIVE-ENCRYPT`. |
| DriverProfile.userId / fullName / ratingAverage / version | id / text(120) / số thực / số nguyên | Y/Y/N/Y | Y/N/N/N | fullName `SENSITIVE-ENCRYPT`; rating 1..5. |
| Vehicle.id / driverId / vehicleTypeId | id / id / id | Y/Y/Y | Y/Y/N | vehicleTypeId là ref nội bộ danh mục. |
| Vehicle.plate / status | text(15) / enum | Y/Y | Y/N | plate `SENSITIVE-ENCRYPT` + blind index. |
| DriverLocation.driverId / lat / lng / receivedAt / tripId | id / số thực / số thực / thời điểm / id | Y/Y/Y/Y/N | N | tripId `ref → BC-02`; WGS84, bản mới hơn thắng. |
| DriverApplication.id / driverId / status | id / id / enum | Y/Y/Y | Y/Y/N | PENDING_REVIEW→APPROVED/REJECTED. |
| DriverApplication.reviewerId / reason | id / text(500) | N/N | N | reviewerId ref User. |
| DriverDocument.id / driverId / type / fileKey / maskedValue / status | id / id / enum / text(255) / text(80) / enum | Y/Y/Y/Y/Y/Y | id,fileKey | fileKey và maskedValue `SENSITIVE-ENCRYPT`. |
| Availability.driverId / status / lastLocationAt / version | id / enum / thời điểm / số nguyên | Y/Y/N/Y | driverId | >300 giây tự OFFLINE. |
| VehicleType.id / code / name / active | id / text(30) / text(80) / boolean | Y/Y/Y/Y | id,code | code MOTORBIKE/CAR_4_SEAT. |
| IdempotencyRecord.subjectId / key / payloadHash / response / expiresAt | id / id / text(64) / JSON / thời điểm | Y | cặp subjectId+key | TTL 24 giờ; payloadHash không chứa plaintext nhạy cảm. |
| RefreshToken.id / userId / tokenHash / expiresAt / revokedAt | id / id / text(255) / thời điểm / thời điểm | Y/Y/Y/Y/N | id,tokenHash | tokenHash `SENSITIVE-HASH`. |
| LoginAttempt.id / phoneHash / ip / success / attemptedAt | id / text(64) / text(45) / boolean / thời điểm | Y | id | phoneHash `SENSITIVE-HASH`; IP `SENSITIVE-ENCRYPT`. |
| RateLimitCounter.scopeKey / windowStart / count / expiresAt | text(160) / thời điểm / số nguyên / thời điểm | Y | scopeKey | dữ liệu tạm theo DEC-30. |

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

Engine chính: **PostgreSQL 16**, database `cab_identity_db`; Redis bổ trợ cho GEO vị trí nóng, OTP TTL, login/rate counter và idempotency. Quan hệ 1–1, phone/plate unique, duyệt hồ sơ/version cần ACID. Không chọn MongoDB vì invariant và unique nhiều hơn lợi ích schema linh hoạt; không chọn Redis làm nguồn thật vì hồ sơ/xe phải bền vững, backup được. Service không truy cập database khác.

##### 5.2. Mô hình vật lý

Các bảng chính: `users`, `customer_profiles`, `driver_profiles`, `vehicles`, `driver_locations`, `driver_applications`, `driver_documents`, `availabilities`, `vehicle_types`, `refresh_tokens`, `login_attempts`, `idempotency_records`, `outbox_events`. PK UUID; index unique trên blind index phone/plate; `(driver_id, received_at DESC)` cho location; `(status, received_at)` cho application.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  phone_ciphertext bytea NOT NULL,
  phone_nonce bytea NOT NULL,
  phone_key_version text NOT NULL,
  phone_blind_index char(64) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('CUSTOMER','DRIVER','OPERATOR','ADMIN','EXECUTIVE')),
  status varchar(16) NOT NULL CHECK (status IN ('PENDING','ACTIVE','LOCKED','DISABLED')),
  must_change_password boolean NOT NULL
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
```

Redis:

| Key pattern | Kiểu | TTL | Mục đích/nguồn |
| --- | --- | --- | --- |
| `geo:drivers:available` | GEO | cập nhật liên tục; member xóa khi OFFLINE | Truy vấn vị trí nóng, DEC-03/18. |
| `otp:driver:{challengeId}` | HASH | 5 phút | hash OTP, số lần thử; giả định phiếu #21. |
| `idem:{subjectId}:{key}` | HASH | 24 giờ | payload hash + trạng thái + response, DEC-34. |
| `login:{phoneHash}:{window}` | COUNTER | 15 phút | khóa lần sai thứ 5, DEC-29. |
| `ratelimit:{scope}:{window}` | COUNTER | 60 giây | DEC-30. |

GEO phiếu #13: `GEOSEARCH geo:drivers:available FROMLONLAT 106.700806 10.776889 BYRADIUS 1 km ASC COUNT 21`; lọc lại User/Application/Vehicle/Availability hợp lệ, trả tối đa `limit≤100`. Cursor là `(distanceMeters,driverId)` cuối, ổn định hơn offset khi vị trí đổi. PostgreSQL vẫn là nguồn thật; Redis rebuild từ location mới nhất.

Bảo vệ: password dùng Argon2id có salt (`123400` → `$argon2id$v=19$...`), không mã hóa thuận nghịch. Phone/fullName/plate/fileKey dùng AES-256-GCM, lưu ciphertext/nonce/keyVersion; khóa ngoài DB, xoay theo version; phone/plate tìm bằng HMAC blind index. Tất cả query dùng parameter binding, DB user chỉ có quyền database này.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| User, CustomerProfile, DriverProfile, Vehicle | `users`, `customer_profiles`, `driver_profiles`, `vehicles` |
| DriverLocation, Availability, VehicleType | `driver_locations` + Redis GEO, `availabilities`, `vehicle_types` |
| DriverApplication, DriverDocument | `driver_applications`, `driver_documents` |
| IdempotencyRecord, RefreshToken, LoginAttempt, RateLimitCounter | `idempotency_records` + Redis, `refresh_tokens`, `login_attempts`, Redis counter |

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
| DEC/NFR | DEC-03–05, 13, 16, 17, 19, 20, 24, 34, 36; NFR-01–03, 11, 14 | 5 km, offer 20 giây, hard stop 180 giây, concurrency/version, ownership. |
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
- Phát: `RideRequested`, `RideOfferCreated`, `RideAssigned`, `RideRequestCancelled`, `TripStatusChanged`, `TripCompleted`, `RatingCreated`, `AuditRecorded`.
- Tiêu thụ: `DriverLocationUpdated`, `AvailabilityChanged`, `IncidentResolved`.
- REST đồng bộ: query candidate/snapshot ở BC-01, fare estimate ở BC-03. Role/ownership theo manifest.

`⚠ Giả định (bổ sung theo phiếu chấm)`: API-X07 dùng page 1..1000, size 1..100 như BC-12 và chỉ trả RideRequest của `sub`; SRS UC-14 có lịch sử nhưng §12.1 chưa có endpoint.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| RideRequest | ENT-05 | aggregate root | Yêu cầu tìm xe; giữ quote và price version ref. |
| Trip | ENT-06 | aggregate root | Chuyến được gán và state machine. |
| Rating | ENT-11 | aggregate root | Một đánh giá cho một Trip. |
| RideOffer | ENT-13 | aggregate root | Lời mời tài xế có hạn. |
| StatusHistory | ENT-15 | entity bất biến | Lịch sử chuyển trạng thái RideRequest/Trip. |

| Entity.Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/nguồn |
| --- | --- | --- | --- | --- |
| RideRequest.id / customerId | id / id | Y/Y | id | customerId `ref → BC-01`. |
| RideRequest.pickup / destination / vehicleTypeId | GeoPoint / GeoPoint / id | Y/Y/Y | N | vùng lat 10.35..11.20, lng 106.35..107.05; vehicleTypeId ref BC-01. |
| RideRequest.quotedFareVnd / priceVersionId | tiền / id | N/N | N | ref snapshot BC-03. |
| RideRequest.status / version | enum / số nguyên | Y/Y | N | SEARCHING→ASSIGNED/NO_DRIVER_FOUND/CANCELLED. |
| Trip.id / rideRequestId / driverId | id / id / id | Y/Y/Y | id,rideRequestId | driverId `ref → BC-01`. |
| Trip.status / distanceMeters / distanceSource / version | enum / số nguyên / enum / số nguyên | Y/N/N/Y | N | Không lùi trạng thái. |
| Rating.id / tripId / customerId / score / comment | id / id / id / số nguyên / text(500) | Y/Y/Y/Y/N | id,tripId | score nguyên 1..5, trong 7 ngày. |
| RideOffer.id / rideRequestId / driverId / expiresAt / status / version | id / id / id / thời điểm / enum / số nguyên | Y | id | Một driver tối đa một PENDING toàn hệ thống. |
| StatusHistory.id / aggregateType / aggregateId / fromStatus / toStatus / actorId / at | id / enum / id / text(40) / text(40) / id / thời điểm | Y/Y/Y/N/Y/N/Y | id | Append-only; actorId ref BC-01. |

Quan hệ: RideRequest 1–N RideOffer; RideRequest 0–1 Trip; Trip 0–1 Rating; RideRequest/Trip 1–N StatusHistory. Invariant: customer tối đa một request/trip mở; không mở offer sau giây 160; offer kết thúc ≤180; tối đa 9 offer từ trần 10 candidate; ACCEPT cạnh tranh chỉ một winner; hủy Trip chỉ trước PICKED_UP, sau đó dùng Incident.

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

Engine chính **PostgreSQL 16**, `cab_ride_db`; Redis bổ trợ timer offer, lock ngắn, candidate exclusion và idempotency. ACCEPT/version/state transition cần transaction và unique constraint. MongoDB không thuận lợi cho cạnh tranh nhiều aggregate; Redis không đủ bền cho Trip/history. Ride là service duy nhất truy cập database này.

##### 5.2. Mô hình vật lý

`ride_requests`, `ride_offers`, `trips`, `ratings`, `status_history`, `idempotency_records`, `outbox_events`. Index: partial unique customer request mở; partial unique driver offer PENDING; `(ride_request_id,status,expires_at)`; `(customer_id,status)`; `(driver_id,status)`.

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
  status varchar(24) NOT NULL CHECK (status IN ('SEARCHING','ASSIGNED','NO_DRIVER_FOUND','CANCELLED')),
  version integer NOT NULL CHECK (version > 0)
);
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
  driver_id uuid NOT NULL,
  status varchar(32) NOT NULL,
  distance_meters integer,
  distance_source varchar(32),
  version integer NOT NULL CHECK (version > 0)
);
```

| Redis key | Kiểu | TTL | Mục đích |
| --- | --- | --- | --- |
| `offer:{offerId}` | HASH/ZSET timer | 20 giây | Hết hạn offer theo DEC-03/16. |
| `dispatch:{rideRequestId}` | HASH | 180 giây | elapsed, driver đã mời/loại. |
| `driver:pending-offer:{driverId}` | STRING | tối đa 20 giây | Chặn offer PENDING thứ hai. |
| `idem:{subjectId}:{key}` | HASH | 24 giờ | Replay API thay đổi trạng thái. |

Mọi query parameterized; DB role chỉ có quyền `cab_ride_db`. Dữ liệu ID không chứa secret; comment rating là user content, lưu nguyên văn và escape khi xuất HTML.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| RideRequest | `ride_requests` |
| RideOffer | `ride_offers` + Redis timer |
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
  state Fare {
    [*] --> PENDING
    PENDING --> FINALIZED: distance hợp lệ
    PENDING --> FARE_REVIEW_REQUIRED: <2 điểm hợp lệ
    FARE_REVIEW_REQUIRED --> FINALIZED: OPERATOR verify distance
  }
  state Payment {
    [*] --> UNPAID
    UNPAID --> PENDING: create sandbox attempt
    PENDING --> SUCCEEDED: valid callback/cash confirm
    PENDING --> FAILED: final failure
    PENDING --> UNKNOWN: timeout
    FAILED --> PENDING: retry, tối đa 2
    UNKNOWN --> SUCCEEDED: reconciliation
    UNKNOWN --> FAILED: reconciliation
  }
```

#### Bước 3. Microservice

- Service/database/container/port: `billing-service` / `cab_billing_db` / `billing-service` / 8083; health `/health`, readiness `/ready`.
- API sở hữu: API-18–API-23.
- Aggregate root: PriceVersion, Fare, Payment; PaymentAttempt là entity trong Payment aggregate.
- Phát: `FareFinalized`, `FareReviewRequired`, `PaymentStatusChanged`, `AuditRecorded`.
- Tiêu thụ: `RideRequested` để giữ quote/version, `TripCompleted` để chốt Fare.
- REST: Ride gọi estimate; Operations gọi Fare review. Callback API-23 không JWT, bắt buộc `X-Signature: sha256=<64 hex>` theo SRS §12.1.2.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| Fare | ENT-08 | aggregate root | Cước duy nhất của Trip. |
| Payment | ENT-09 | aggregate root | Kết quả thanh toán duy nhất của Trip. |
| PaymentAttempt | ENT-14 | entity | Một lần thử sandbox của Payment. |
| PriceVersion | ENT-16 | aggregate root | Phiên bản biểu giá bất biến theo lịch sử. |

| Entity.Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/nguồn |
| --- | --- | --- | --- | --- |
| Fare.id / tripId / priceVersionId | id / id / id | Y/Y/Y | id,tripId | tripId `ref → BC-02`. |
| Fare.distanceMeters / distanceSource / amountVnd | số nguyên / enum / tiền | N/N/N | N | amount null khi review. |
| Fare.status / version | enum / số nguyên | Y/Y | N | PENDING/FARE_REVIEW_REQUIRED/FINALIZED. |
| Payment.id / tripId / method / status / paidAt / version | id / id / enum / enum / thời điểm / số nguyên | Y/Y/Y/Y/N/Y | id,tripId | UNPAID→PENDING→SUCCEEDED/FAILED/UNKNOWN. |
| PaymentAttempt.id / paymentId / scenario / providerRef / status | id / id / enum / text(100) / enum | Y/Y/Y/N/Y | id,providerRef nếu có | scenario theo DEC-27. |
| PriceVersion.id / vehicleTypeId / baseFareVnd / includedMeters / perKmVnd / effectiveAt / status | id / id / tiền / số nguyên / tiền / thời điểm / enum | Y | id | vehicleTypeId ref BC-01; DRAFT→ACTIVE→RETIRED. |

Quan hệ: PriceVersion 1–N Fare; Fare 1–1 Trip logic; Trip logic 1–1 Payment; Payment 1–N PaymentAttempt. Invariant: PriceVersion của request không đổi; Fare FINALIZED bất biến; PENDING/UNKNOWN chặn attempt/phương thức mới; callback trùng không thu đôi; chỉ retry sau FAILED, tối đa hai lần.

```mermaid
erDiagram
  PriceVersion ||--o{ Fare : prices
  Fare ||--o| Payment : enables
  Payment ||--o{ PaymentAttempt : attempts
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Engine chính **PostgreSQL 16**, `cab_billing_db`; Redis giữ idempotency/callback lock ngắn. Tiền, unique 1–1, version và callback cạnh tranh cần ACID/audit. MongoDB không đem lại lợi ích cho schema ổn định; Redis không là ledger bền vững. Không service khác truy cập database này.

##### 5.2. Mô hình vật lý

`price_versions`, `fares`, `payments`, `payment_attempts`, `idempotency_records`, `provider_events`, `outbox_events`. Unique `fares.trip_id`, `payments.trip_id`, `payment_attempts.provider_ref`; index `(payment_id,status)` và `(status,effective_at)`.

```sql
CREATE TABLE fares (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL UNIQUE,
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
```

| Redis key | Kiểu | TTL | Mục đích |
| --- | --- | --- | --- |
| `idem:{subjectId}:{key}` | HASH | 24 giờ | Payment/review/cash idempotency. |
| `provider:event:{providerEventId}` | STRING | 24 giờ, sau đó bản bền vững vẫn giữ | Fast dedupe callback. |
| `payment:lock:{paymentId}` | STRING NX | 10 giây | Serialize callback/confirm cạnh tranh. |

Fare demo: MOTORBIKE 2.001 m → `10.000 + 1/1000×4.000 = 10.004`, làm tròn 11.000 VND; CAR_4_SEAT tương ứng 26.000 VND. Query dùng parameter binding; DB role riêng. CAB không lưu số thẻ/CVV/token provider. Callback secret ở secret store, không DB; log chỉ providerRef đã mask.

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
- Phát: `NotificationRead`, delivery metric; tiêu thụ Ride/Billing/Identity domain events.
- Không gọi đồng bộ service nguồn; SSE payload chứa resource ID để client GET owner API xác nhận.
- CUSTOMER/DRIVER chỉ đọc recipientId bằng JWT `sub`.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| Notification | ENT-10 | aggregate root | Inbox idempotent theo recipientId+eventId. |

| Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/nguồn |
| --- | --- | --- | --- | --- |
| id | id | Y | Y | ID thông báo. |
| recipientId | id | Y | cặp với eventId | `ref → BC-01`; actor sở hữu. |
| eventId | id | Y | cặp với recipientId | Dedupe at-least-once. |
| type | text(64) | Y | N | Loại domain event cho client. |
| readAt | thời điểm | N | N | null=CREATED, có giá trị=READ. |

Quan hệ logic: một recipient có nhiều Notification; event có tối đa một Notification/recipient. Invariant: chỉ CREATED→READ, không unread; lỗi ghi/SSE không đảo giao dịch nguồn; Last-Event-ID chỉ checkpoint delivery, không thay đổi nghiệp vụ.

```mermaid
erDiagram
  RecipientRef ||--o{ Notification : receives
  EventRef ||--o{ Notification : materializes
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Engine chính **MongoDB 7**, database `cab_notification_db`; Redis giữ SSE connection/checkpoint ngắn hạn. Inbox đọc nhiều theo recipient, payload từng event có thể mở rộng và không có quan hệ giao dịch phức tạp, phù hợp document. PostgreSQL vẫn làm được nhưng migration payload event kém linh hoạt; Redis không được dùng làm nguồn inbox vì reconnect cần dữ liệu bền vững.

##### 5.2. Mô hình vật lý

Collection `notifications` có unique compound index `{recipientId:1,eventId:1}`, inbox index `{recipientId:1,createdAt:-1,_id:-1}`. Cursor là `(createdAt,id)`, `size≤100`. Không TTL bản ghi inbox trong pilot vì retention production chưa chốt.

```json
{
  "_id": "550e8400-e29b-41d4-a716-446655440000",
  "recipientId": "550e8400-e29b-41d4-a716-446655440002",
  "eventId": "550e8400-e29b-41d4-a716-446655440003",
  "type": "RideOfferCreated",
  "resource": {"rideOfferId":"550e8400-e29b-41d4-a716-446655440004","expiresAt":"2026-09-29T09:15:20+07:00"},
  "createdAt": "2026-09-29T09:15:00+07:00",
  "readAt": null
}
```

| Redis key | Kiểu | TTL | Mục đích |
| --- | --- | --- | --- |
| `sse:connection:{userId}:{connectionId}` | HASH | 60 giây heartbeat | Connection registry. |
| `sse:last:{userId}` | STRING | 24 giờ | Last delivered event hint; DB vẫn là nguồn. |

Mongo query dùng driver binding, allow-list sort/filter; không dựng `$where` từ input. Nội dung event lưu nguyên văn JSON an toàn, response `application/json`/`text/event-stream`; web client escape text, CSP chặn inline script.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| Notification | collection `notifications`; Redis chỉ connection/checkpoint |

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
- Phát: `IncidentCreated`, `IncidentResolved`, `TerminateTripRequested`, `FareReviewRequested`, `AuditRecorded` của thao tác nội bộ.
- Tiêu thụ: toàn bộ `AuditRecorded`, Ride/Billing events để dựng projection.
- REST: gửi command có Idempotency-Key tới Ride/Billing; không cập nhật database của chúng.

#### Bước 4. Mô hình dữ liệu logic

| Entity | ENT | Vai trò | Mô tả |
| --- | --- | --- | --- |
| AuditRecord | ENT-12 | value event | Payload audit đã mask do service nguồn phát. |
| AuditLog | ENT-17 | entity append-only | Bản ghi Operations nhận idempotent. |
| Incident | ENT-18 | aggregate root | Sự cố actor hoặc hệ thống tạo. |
| OutboxEvent | ENT-24 | entity kỹ thuật chuẩn | Contract outbox; instance cục bộ ở từng service. |
| ReportProjection | ENT-28 | aggregate root/read model | Metric theo ngày và dimensions. |

| Entity.Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/nguồn |
| --- | --- | --- | --- | --- |
| AuditRecord.id / eventId / actorId / action / targetId / beforeAfter | id / id / id / text(80) / id / JSON | Y/Y/N/Y/Y/N | id,eventId | actorId ref BC-01; diff đã mask. |
| AuditLog.id / auditRecordId / traceId / occurredAt | id / id / text(64) / thời điểm | Y | id,auditRecordId | Append-only. |
| Incident.id / tripId / source / reason / status / resolution / version | id / id / enum / text(500) / enum / enum / số nguyên | Y/Y/Y/Y/Y/N/Y | id | tripId `ref → BC-02`; reason có thể nhạy cảm. |
| OutboxEvent.id / aggregateId / eventType / payload / occurredAt / publishedAt | id / id / text(100) / JSON / thời điểm / thời điểm | Y/Y/Y/Y/Y/N | id | Append cùng transaction aggregate. |
| ReportProjection.metricDate / dimensions / metrics / sourceEventId | ngày / JSON / JSON / id | Y | sourceEventId | Timezone Asia/Ho_Chi_Minh; rebuild được. |

Quan hệ: TripRef 1–N Incident; AuditRecord 1–1 AuditLog; source Event 1–N projection cell theo dimension. Invariant: một Incident SYSTEM cho mỗi trip/type/ngưỡng; đúng 30 phút chưa tạo, 30:00.001 mới tạo; resolution không sửa Payment; consumer audit/projection idempotent.

```mermaid
erDiagram
  TripRef ||--o{ Incident : has
  AuditRecord ||--|| AuditLog : materializes
  SourceEventRef ||--o{ ReportProjection : updates
```

#### Bước 5. CSDL

##### 5.1. Chọn loại CSDL

Engine chính **PostgreSQL 16**, `cab_operations_db`; không cần Redis cho nguồn nghiệp vụ, có thể dùng cache báo cáo ngắn hạn nhưng mặc định không dùng. Incident version/audit unique cần ACID; JSONB cho dimensions/metrics đủ linh hoạt. MongoDB thuận tiện projection nhưng làm yếu transaction Incident/audit; Redis không bền và không phù hợp backup hằng ngày.

##### 5.2. Mô hình vật lý

`incidents`, `audit_logs`, `report_projections`, `active_trip_projections`, `processed_events`, `outbox_events`. Unique `(trip_id,source,reason_code)` cho incident hệ thống; unique `audit_record_id`, `source_event_id`; index `(status,created_at)`, GIN dimensions, `(metric_date)`.

```sql
CREATE TABLE incidents (
  id uuid PRIMARY KEY,
  trip_id uuid NOT NULL,
  source varchar(12) NOT NULL CHECK (source IN ('CUSTOMER','DRIVER','OPERATOR','SYSTEM')),
  reason varchar(500) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  resolution varchar(24),
  version integer NOT NULL CHECK (version > 0)
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
  source_event_id uuid NOT NULL UNIQUE
);
```

Reason/beforeAfter có thể chứa dữ liệu cá nhân: validate/mask tại nguồn, trường cần đọc lại mã hóa AES-256-GCM với keyVersion; không ghi token/phone đầy đủ. Query báo cáo dùng binding, allow-list `groupBy`, kỳ tối đa 366 ngày; DB role read/write đúng schema này.

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
| ReportProjection | Read model được dựng từ event. | Rebuild được; có asOf. |
| Revenue | Tổng Fare của Trip hoàn thành đã thanh toán. | Theo paidAt, Asia/Ho_Chi_Minh. |
| Acceptance Rate | ACCEPTED/(ACCEPTED+DECLINED+EXPIRED). | Không tính CANCELLED; mẫu số 0 trả null. |
| Find-driver Rate | ASSIGNED/(ASSIGNED+NO_DRIVER_FOUND). | Khác completion rate. |
