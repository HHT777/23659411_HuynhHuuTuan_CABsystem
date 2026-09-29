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
| `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` | `/run/secrets/jwt_private.pem`, `/run/secrets/jwt_public.pem` | Identity ký; Gateway/service kiểm chữ ký |
| `FIELD_ENCRYPTION_KEY`, `FIELD_KEY_VERSION` | `base64-demo-not-a-real-key`, `v1` | Identity & Driver |
| `IDENTITY_DB_URL` | `postgresql://cab_identity:demo@postgres:5432/cab_identity_db` | Identity & Driver |
| `RIDE_DB_URL` | `postgresql://cab_ride:demo@postgres:5432/cab_ride_db` | Ride |
| `BILLING_DB_URL` | `postgresql://cab_billing:demo@postgres:5432/cab_billing_db` | Billing |
| `NOTIFICATION_DB_URL` | `postgresql://cab_notification:demo@postgres:5432/cab_notification_db` | Notification |
| `OPERATIONS_DB_URL` | `postgresql://cab_operations:demo@postgres:5432/cab_operations_db` | Operations & Reporting |
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
| Rate limit | Gateway một instance đếm cửa sổ IP/user trong bộ nhớ theo DEC-30; trả 429 và `Retry-After`. |
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/ready || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10

  identity-driver-service:
    build:
      context: ./services/identity-driver-service
    environment:
      IDENTITY_DB_URL: postgresql://cab_identity:${IDENTITY_DB_PASSWORD}@postgres:5432/cab_identity_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8081/ready || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10

  ride-service:
    build:
      context: ./services/ride-service
    environment:
      RIDE_DB_URL: postgresql://cab_ride:${RIDE_DB_PASSWORD}@postgres:5432/cab_ride_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8082/ready || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10

  billing-service:
    build:
      context: ./services/billing-service
    environment:
      BILLING_DB_URL: postgresql://cab_billing:${BILLING_DB_PASSWORD}@postgres:5432/cab_billing_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8083/ready || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10

  notification-service:
    build:
      context: ./services/notification-service
    environment:
      NOTIFICATION_DB_URL: postgresql://cab_notification:${NOTIFICATION_DB_PASSWORD}@postgres:5432/cab_notification_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8084/ready || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10

  operations-reporting-service:
    build:
      context: ./services/operations-reporting-service
    environment:
      OPERATIONS_DB_URL: postgresql://cab_operations:${OPERATIONS_DB_PASSWORD}@postgres:5432/cab_operations_db
      RABBITMQ_URL: amqp://cab:${RABBITMQ_PASSWORD}@rabbitmq:5672/cab
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
      test: ["CMD-SHELL", "wget -qO- http://localhost:8085/ready || exit 1"]
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

| Entity.Field | Kiểu logic | Bắt buộc | Duy nhất | Ràng buộc/độ nhạy cảm |
| --- | --- | --- | --- | --- |
| User.id / phone | id / E.164(15) | Y/Y | Y/Y | phone `SENSITIVE-ENCRYPT`, dấu vân tay HMAC để kiểm tra duy nhất. |
| User.passwordHash | text(255) | Y | N | `SENSITIVE-HASH`; không bao giờ trả API. |
| User.roles / status / mustChangePassword | set<Role> / enum / boolean | Y/Y/Y | N | Một role pilot; PENDING→ACTIVE↔LOCKED→DISABLED. |
| CustomerProfile.userId / fullName / createdAt | id / text(120) / thời điểm | Y/Y/Y | Y/N/N | userId logical 1–1; fullName `SENSITIVE-ENCRYPT`. |
| DriverProfile.userId / fullName / ratingAverage / version | id / text(120) / số thực / số nguyên | Y/Y/N/Y | Y/N/N/N | fullName `SENSITIVE-ENCRYPT`; rating 1..5. |
| Vehicle.id / driverId / vehicleTypeId | id / id / id | Y/Y/Y | Y/Y/N | vehicleTypeId là ref nội bộ danh mục. |
| Vehicle.plate / status | text(15) / enum | Y/Y | Y/N | plate `SENSITIVE-ENCRYPT` + dấu vân tay HMAC để so khớp. |
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
| OtpChallenge.id / phoneHash / otpHash / attempts / expiresAt / verifiedAt | id / text(64) / text(255) / số nguyên / thời điểm / thời điểm | Y/Y/Y/Y/Y/N | id | OTP sống 5 phút, tối đa 5 lần thử; giả định phiếu #21. |

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
CREATE TABLE idempotency_records (
  subject_id uuid NOT NULL,
  key uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  state varchar(12) NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  response jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, key)
);
```

Truy vấn phiếu #13 lọc bounding box quanh `10.776889,106.700806`, sau đó tính Haversine trong SQL và giữ `distance_meters<=1000`, sắp `(distanceMeters,driverId)`, lấy `limit+1` với `limit≤100`. Cursor là cặp cuối, ổn định hơn offset. `driver_current_locations` phục vụ truy vấn mới nhất; `driver_locations` giữ lịch sử ENT-07 để cộng quãng đường. Job xóa OTP/idempotency hết hạn; LoginAttempt được query trực tiếp trong cửa sổ 15 phút.

Bảo vệ: password dùng Argon2id có salt (`123400` → `$argon2id$v=19$m=65536,t=3,p=1$ZGVtby1zYWx0$ZGVtby1oYXNo`), không mã hóa thuận nghịch. Phone/fullName/plate/fileKey dùng AES-256-GCM, lưu ciphertext/nonce/keyVersion; khóa ngoài DB, xoay theo version; phone/plate tìm bằng HMAC blind index. Tất cả query dùng parameter binding, DB user chỉ có quyền database này.

| Entity logic | Ánh xạ vật lý |
| --- | --- |
| User, CustomerProfile, DriverProfile, Vehicle | `users`, `customer_profiles`, `driver_profiles`, `vehicles` |
| DriverLocation, Availability, VehicleType | `driver_locations` + `driver_current_locations`, `availabilities`, `vehicle_types` |
| DriverApplication, DriverDocument | `driver_applications`, `driver_documents` |
| IdempotencyRecord, RefreshToken, LoginAttempt | `idempotency_records`, `refresh_tokens`, `login_attempts` |
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

Database `cab_ride_db`, user `cab_ride`. ACCEPT cạnh tranh, version/state transition và một Trip/driver mở cần transaction, khóa hàng và partial unique index. Offer timer/hard stop lấy từ `expires_at`/`search_started_at`; idempotency lưu trong bảng cục bộ. Ride là service duy nhất truy cập database này.

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
  search_started_at timestamptz NOT NULL,
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
CREATE TABLE idempotency_records (
  subject_id uuid NOT NULL,
  key uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  state varchar(12) NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  response jsonb,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject_id, key)
);
```

Scheduler mỗi giây chọn offer hết hạn bằng `WHERE status='PENDING' AND expires_at<=now() FOR UPDATE SKIP LOCKED`; elapsed điều phối lấy từ `ride_requests.search_started_at`, nên restart vẫn tiếp tục đúng mốc 160/180 giây. Partial unique offer PENDING chặn lời mời thứ hai; bảng `idempotency_records` giữ response 24 giờ và được job dọn định kỳ.

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

Database `cab_billing_db`, user `cab_billing`. Fare/Payment 1–1 Trip, số tiền, version và callback cạnh tranh cần transaction/unique. Idempotency dùng bảng cục bộ; callback dedupe bằng `provider_events`, còn cập nhật Payment serialize bằng khóa hàng. Không service khác truy cập database này.

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
```

Callback insert `provider_events` trước; trùng PK trả kết quả đã có. Transaction khóa hàng Payment bằng `SELECT FOR UPDATE`, kiểm tra trạng thái rồi mới cập nhật PaymentAttempt/Payment và outbox. `idempotency_records` giữ thao tác review/cash/payment 24 giờ; job xóa bản hết hạn.

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

Database `cab_notification_db`, user `cab_notification`. Dedupe `(recipientId,eventId)`, chuyển READ một chiều và phân trang ổn định cần unique/index; `resource` linh hoạt lưu `jsonb`. SSE connection registry giữ trong bộ nhớ tiến trình, còn reconnect dùng Last-Event-ID đọc lại bản ghi bền vững.

##### 5.2. Mô hình vật lý

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
INSERT INTO notifications(id,recipient_id,event_id,type,resource,created_at,read_at)
VALUES ('550e8400-e29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003','RideOfferCreated',
        '{"rideOfferId":"550e8400-e29b-41d4-a716-446655440004","expiresAt":"2026-09-29T09:15:20+07:00"}',
        '2026-09-29T09:15:00+07:00',NULL);
```

Cursor `(createdAt,id)`, `size≤100`; không xóa inbox theo TTL vì retention production chưa chốt. Registry SSE nằm trong bộ nhớ notification-service. Last-Event-ID ánh xạ tới cursor và query các hàng mới hơn. Query dùng parameter binding/allow-list sort; nội dung resource trả JSON, web client escape text và CSP chặn inline script.

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

Database `cab_operations_db`, user `cab_operations`. Incident theo version, audit append-only và consumer dedupe cần transaction/unique; dimensions/metrics dùng `jsonb`, báo cáo theo kỳ dùng index ngày. Service không dùng cache ngoài tiến trình và không truy cập database khác.

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

## Phần III. Tổng hợp xuyên hệ thống

### III.1. BC → Microservice → database → API → UC

| BC | Microservice | Database | API sở hữu | UC sở hữu | Số entity |
| --- | --- | --- | --- | --- | ---: |
| BC-01 Identity & Driver | `identity-driver-service` | `cab_identity_db` (PostgreSQL) | API-01–10; API-X04–06, X08–12 | UC-01.1, 01.2, 02, 03.1, 03.2, 04, 08, 16.2, 16.3, 16.5, 16.6 | 13 |
| BC-02 Ride | `ride-service` | `cab_ride_db` (PostgreSQL) | API-11–17; API-X07 | UC-05.1, 05.2, 06.1–06.3, 07.1–07.2, 09.1–09.2, 10, 14, 15 | 5 |
| BC-03 Billing | `billing-service` | `cab_billing_db` (PostgreSQL) | API-18–23 | UC-11, 11.2, 12.1–12.4, 16.4 | 4 |
| BC-04 Notification | `notification-service` | `cab_notification_db` (PostgreSQL) | API-24–26 | UC-13.1–13.3 | 1 |
| BC-05 Operations & Reporting | `operations-reporting-service` | `cab_operations_db` (PostgreSQL) | API-27–30; API-X01–03 | UC-16.1, 16.7, 17.1–17.3, 18.1–18.2 | 5 |

Số BC = số microservice nghiệp vụ = số database `cab_*_db` = 5; năm database nằm trên một container PostgreSQL. RabbitMQ là broker, không phải database nghiệp vụ.

### III.2. Hợp đồng event

| Event v1 | Producer | Consumer | Payload chính | Khóa/dedupe |
| --- | --- | --- | --- | --- |
| `DriverLocationUpdated.v1` | BC-01 | BC-02, BC-05 | eventId, driverId, lat, lng, receivedAt, tripId | eventId; driverId+receivedAt |
| `RideRequested.v1` | BC-02 | BC-04, BC-05 | eventId, rideRequestId, vehicleTypeId, pickup, occurredAt | eventId |
| `RideOfferCreated.v1` | BC-02 | BC-04 | eventId, offerId, driverId, expiresAt | eventId+recipientId |
| `RideAssigned.v1` | BC-02 | BC-01, BC-04, BC-05 | eventId, tripId, customerId, driverId, version | eventId; tripId+version |
| `TripStatusChanged.v1` | BC-02 | BC-01, BC-03, BC-04, BC-05 | eventId, tripId, from, to, version, occurredAt | eventId; tripId+version |
| `TripCompleted.v1` | BC-02 | BC-03, BC-05 | eventId, tripId, vehicleTypeId, priceVersionId, distanceMeters | eventId; tripId+version |
| `FareFinalized.v1` | BC-03 | BC-04, BC-05 | eventId, fareId, tripId, amountVnd, status, version | eventId; fareId+version |
| `PaymentStatusChanged.v1` | BC-03 | BC-04, BC-05 | eventId, paymentId, attemptId, status, paidAt | eventId; attemptId+status |
| `IncidentResolved.v1` | BC-05 | BC-02, BC-03, BC-04 | eventId, incidentId, tripId, resolution, version | eventId; incidentId+version |
| `AuditRecorded.v1` | BC-01–05 | BC-05 | eventId, actorId, action, targetId, occurredAt, maskedDiff | eventId |

### III.3. Ranh giới giao dịch và xử lý thất bại

- Trong service: aggregate + StatusHistory/outbox/idempotency record commit cùng transaction. Giữa service: RabbitMQ at-least-once, eventual consistency, không distributed transaction.
- Offer hết hạn: scheduler mỗi giây khóa các hàng `ride_offers` hết hạn bằng `FOR UPDATE SKIP LOCKED`; nếu vẫn PENDING thì EXPIRED, phát event và chọn vòng mới. ACCEPT đến 20.001 giây trả 410; đúng 20.000 giây chỉ thắng nếu commit trước expiry transition.
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
| BC-01 | DEC-02, DEC-09, DEC-18, DEC-25, DEC-26, DEC-29, DEC-30, DEC-33, DEC-35, DEC-38 |
| BC-02 | DEC-03, DEC-04, DEC-05, DEC-13, DEC-16, DEC-17, DEC-19, DEC-20, DEC-24, DEC-34, DEC-36 |
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

## Phần IV. Bảo mật xuyên hệ thống

### IV.1. Xác thực và token

Identity phát access JWT ký `RS256`, hạn 15 phút; claim tối thiểu `sub`, `role`, `iss=cab-identity`, `aud=cab-api`, `iat`, `exp`, `jti`. Refresh token opaque 30 ngày, xoay mỗi lần dùng và chỉ lưu hash; `⚠ Giả định`: SRS chốt cấu trúc token nhưng chưa chốt thuật toán/TTL. Gateway và service kiểm chữ ký bằng public key, không chấp nhận `alg=none`; khóa User thu hồi mọi refresh token và tăng `tokenVersion` để vô hiệu access token hiện tại.

### IV.2. Đe dọa và lớp chặn — Phiếu #24–30

| Phiếu | Đe dọa | Lớp chặn/cơ chế | HTTP | Ví dụ Postman |
| ---: | --- | --- | ---: | --- |
| 24 | Đọc trực tiếp DB | Argon2id cho password; AES-256-GCM + nonce/keyVersion cho phone/name/plate; khóa ngoài DB; blind index HMAC. | 200 API nhưng DB chỉ thấy ciphertext/hash | Đăng ký password `CabPilot2026`, sau đó truy vấn DB qua test fixture xác nhận không có plaintext. |
| 25 | SQL injection | JSON schema, parameter binding/ORM, allow-list sort/filter và user database tối thiểu; không nối chuỗi SQL. | 400/401 | POST `/api/v1/auth/login` body `{"phone":"' OR 1=1 --","password":"anything"}` → 400/401. |
| 26 | Stored/reflected XSS | Lưu comment/reason như text; JSON encoder; UI escape; CSP `default-src 'self'`, `script-src 'self'`; `X-Content-Type-Options: nosniff`. | 201/200, script không chạy | POST rating comment `<script>alert('hack')</script>`; GET trả escaped/render như text. |
| 27 | JWT tampering | RS256 signature, issuer/audience/expiry/tokenVersion; bỏ tin header role từ client. | 401 | Sửa `sub/role` trong `$customerToken`, GET `/api/v1/operations/trips/active` → 401. |
| 28 | Sai role/ownership | Gateway allow-list + service policy mặc định deny; query luôn scope theo `sub`. | 403 | CUSTOMER PUT `/api/v1/drivers/me/availability` → 403, không dữ liệu. |
| 29 | Flood/rate attack | Gateway một instance đếm cửa sổ trong bộ nhớ theo IP/user. DEC-30: login 10/phút/IP, RideRequest 5/phút/user, location 12/phút/driver, chung 100/phút/user; trả `Retry-After`. | 429 | Gửi lần RideRequest thứ 6 trong phút → 429; restart Gateway làm mất cửa sổ hiện tại, là đánh đổi pilot. |
| 30 | Replay/double charge | `Idempotency-Key` UUID, subject+key, payload SHA-256, state IN_PROGRESS/COMPLETED, TTL 24h; cùng payload trả response cũ, khác payload 409. Provider event dedupe. | status cũ/409 | Gửi API-21 hai lần với key `550e8400-e29b-41d4-a716-446655440099` → cùng paymentId, một attempt. |

Request đang xử lý giữ record `IN_PROGRESS`; request trùng trả 409 `IDEMPOTENCY_IN_PROGRESS` và `Retry-After: 1`, không chạy song song. Khi hoàn tất lưu status/body cũ. Secret scan, dependency scan và log scan chạy CI; log bắt buộc correlationId nhưng không token/password/phone đầy đủ.

### IV.3. Ma trận quyền rút gọn

| Role | Nhóm API cho phép | Nhóm bị 403 |
| --- | --- | --- |
| Public | API-01, 02, 03, X08, X09; API-23 dùng HMAC | Mọi API JWT khác |
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

Customer `20000000-0000-4000-8000-000000000001`, phone `+84901234567`, có năm RideRequest seed: SEARCHING, ASSIGNED, NO_DRIVER_FOUND, CANCELLED và Trip COMPLETED. Seed bằng migration idempotent `infra/seed/seed-pilot`; password đều là hash của `CabPilot2026`, không commit hash/secret sản xuất.

### V.2. Chuỗi Postman chính

1. `POST /auth/register`, lưu `customerId`; `POST /auth/login`, lưu `customerToken`.
2. API-X08/X09 xác minh OTP; API-02 tạo hồ sơ; OPERATOR API-X10–X12 duyệt; DRIVER API-06 bật ONLINE và API-07 gửi vị trí.
3. API-18 lấy quote 11.000 VND cho MOTORBIKE 2.001 m; API-11 tạo RideRequest với Idempotency-Key, lưu `rideRequestId`.
4. Driver nhận SSE API-26, API-13 ACCEPT trước 20 giây; lưu `tripId`; Customer API-16 thấy driver nhưng không thấy phone.
5. Driver gọi API-14 lần lượt ARRIVED_AT_PICKUP → PICKED_UP → IN_PROGRESS → COMPLETED, xen API-07 location; assertion version tăng và không bỏ mốc.
6. Customer API-21 chọn `TIMEOUT_THEN_SUCCESS`, mock callback API-23 ký HMAC; assertion Payment SUCCEEDED một lần.
7. Customer API-17 score 5/comment; gọi lần hai cùng Trip với key khác phải 409 vì một Rating/Trip.
8. Chạy negative collection #24–30 và health #6; dùng Postman Runner để lặp rate test.

Biến environment: `baseUrl=http://localhost:8080/api/v1`, `customerToken`, `driverToken`, `operatorToken`, `adminToken`, `customerId`, `driverId`, `rideRequestId`, `offerId`, `tripId`, `fareId`, `paymentId`, `notificationId`, `incidentId`, `idempotencyKey`. Phân trang chuẩn API baseline dùng `page` mặc định 1, `size` mặc định 20/tối đa 100; API-X06 dùng cursor vì dữ liệu vị trí thay đổi nhanh.

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
| 14 | Booking của Customer | BC-02 | GET `/ride-requests?customerId=me&page=1&size=20` | 200, đúng 5 seed, metadata page/size/total | BC-02/API-X07 | API bổ sung |
| 15 | Đặt xe | BC-02 | POST `/ride-requests` `{"pickup":{"lat":10.776889,"lng":106.700806},"destination":{"lat":10.781234,"lng":106.695321},"vehicleTypeId":"550e8400-e29b-41d4-a716-446655440010"}` | 201 SEARCHING, tạo offer tối đa 20 giây | API-11,18 | API có sẵn |
| 16 | Driver nhận chuyến | BC-02/04 | POST `/ride-offers/{offerId}/responses` `{"decision":"ACCEPT","version":1}` | 200 ACCEPTED, một Trip ASSIGNED; Customer nhận driver snapshot | API-13,16,26 | API có sẵn |
| 17 | Cập nhật Trip | BC-02/01 | PUT `/trips/{tripId}/status` lần lượt với `ARRIVED_AT_PICKUP`, `PICKED_UP`, `IN_PROGRESS`, `COMPLETED`, version tăng | 200 từng bước; bỏ bước trả 409/422 | API-07,14 | API có sẵn |
| 18 | Hủy Trip | BC-02/04 | POST `/trips/{tripId}/cancellation` `{"reason":"Đổi kế hoạch","version":2}` | 200 `CANCELLED`; hai bên có Notification | API-15,24–26 | API có sẵn |
| 19 | Thanh toán online | BC-03 | POST `/trips/{tripId}/payments` `{"method":"SANDBOX","sandboxScenario":"SUCCESS"}` rồi POST callback HMAC | 201 PENDING → 200 SUCCEEDED; không double charge | API-21,23 | API có sẵn |
| 20 | Đánh giá | BC-02 | POST `/trips/{tripId}/ratings` `{"score":5,"comment":"Tài xế lịch sự"}` | 201 Rating gắn Trip; lần hai 409 | API-17 | API có sẵn |
| 21 | Đăng ký Driver OTP | BC-01 | POST OTP request `{"phone":"+84909876543"}`, verify `{"challengeId":"30000000-0000-4000-8000-000000000001","otp":"123456"}`, rồi API-02 | 201 DriverApplication PENDING_REVIEW | API-X08/X09, API-02 | API bổ sung + có sẵn |
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
7. JWT dùng RS256, access 15 phút, refresh opaque 30 ngày; SRS chưa chốt thuật toán và TTL cụ thể.
8. ENT-23, ENT-24 là pattern cục bộ nhiều service nhưng cần một chủ schema để ma trận không trùng; lần lượt BC-01 và BC-05 quản trị contract. ENT-27 là contract BC-01, còn Gateway giữ bộ đếm trong bộ nhớ và không tạo bảng vật lý.

### VIII.2. API bổ sung cần cập nhật SRS

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
- SRS chưa có OTP, endpoint đọc Customer/Driver theo ID, booking list, driver application list/detail/decision và health API; cần bổ sung 12 API-X vào §12.1 nếu giảng viên coi chúng là public contract.
