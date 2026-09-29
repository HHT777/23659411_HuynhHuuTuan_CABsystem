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
