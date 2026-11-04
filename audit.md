# CAB System Audit

## Runtime cập nhật sau triển khai database (03/10/2026)

Các mục audit cũ bên dưới được giữ làm lịch sử. Hiện stack đã build/chạy thành công, dùng `STORAGE_MODE=database` và lưu dữ liệu thật trong PostgreSQL/MongoDB.

- Collection Postman: **52 requests, 68 assertions, 0 failures**, gồm endpoint catalog, callback HMAC và xác nhận chuyến PAID.
- `runtime-audit.mjs`: **79 checks, 0 failures**, gồm register/login, nearby/paging, booking/replay, trip, payment, onboarding, SQLi, XSS, JWT và RBAC.
- `verify-database.js`: kết nối host PostgreSQL và URI Compass thành công; kiểm tra password scrypt, giấy tờ AES-GCM và thông báo MongoDB.
- Restart cả bảy service: **12 payment replays đồng thời** trả response đã lưu, không tăng số payment.
- `verify-attacks.js`: OTP dùng một lần; Admin từ chối có lý do và thông báo; driver bị từ chối không thể online; khóa idempotency tách theo user; JWT thừa segment bị từ chối.
- Burst **1005 request đồng thời**: 5 response `400` do body thiếu trường, 1000 response `429`, Gateway vẫn `/ready=200`. Đây là kiểm tra burst/rate limiting, không phải chứng nhận throughput 1000 requests/giây.
- Gateway/contract tests: **4/4 PASS**.

Hướng dẫn và giới hạn bản thực hành: [database-and-postman.md](document/database-and-postman.md). DB ports chỉ mở loopback để pgAdmin/Compass kết nối; Mongo local không authentication. Thanh toán/SMS dùng sandbox; Kafka chưa dùng cho workflow; chưa đánh giá tải production/giao dịch phân tán.

---

## Audit lịch sử trước cập nhật database

- **Ngày audit:** 03/10/2026
- **Phạm vi:** PC1-PC30
- **Runtime:** JavaScript ES Modules, Node.js, Express
- **Kiến trúc:** Gateway + 7 microservice + Kafka + Redis + PostgreSQL + MongoDB
- **Nguyên tắc đánh giá:** Chỉ ghi `PASS` khi có bằng chứng kiểm tra tương ứng. `PARTIAL` là đã có code hoặc boundary nhưng chưa đủ contract/runtime evidence. `BLOCKED` là chưa thể kiểm tra do môi trường. `NOT IMPLEMENTED` là còn thiếu chức năng.

## 1. Tóm tắt hiện trạng

### Đã xác minh

- Toàn bộ implementation nằm trong `backend/`.
- Gateway và 7 service dùng JavaScript/Express.
- OpenAPI/contract checks: `PASS`.
- JavaScript syntax checks: `PASS`.
- Gateway unit/integration tests hiện tại: `2/2 PASS`.
- `docker compose --env-file .env.example config --quiet`: `PASS`.
- `git diff --check`: `PASS`.
- Payment callback HTTP raw-body/HMAC test: `PASS`.
- Không còn Python runtime trong backend, Dockerfile hoặc Compose.

### Chưa thể xác minh runtime

Docker Desktop Linux engine chưa chạy. Lệnh Compose trả lỗi pipe:

```text
npipe:////./pipe/dockerDesktopLinuxEngine
```

Vì vậy chưa thể chạy đầy đủ Gateway, service, database, Kafka và smoke test PC9-PC30 qua HTTP thật.

### Khoảng trống kỹ thuật chính

- Runtime hiện khai báo `STORAGE_MODE=memory` và `durable=false`.
- PostgreSQL/MongoDB repository và migration nghiệp vụ chưa được nối đầy đủ vào workflow.
- PC24 chưa đạt yêu cầu data encryption at rest trên dữ liệu thực trong database.
- Gateway-to-service hiện dùng Internal REST adapter; gRPC nghiệp vụ theo thiết kế v3.7 chưa bật đầy đủ.
- Kafka topic/health đã có, nhưng producer/consumer nghiệp vụ end-to-end chưa có runtime evidence.

## 2. Trạng thái PC1-PC8

|  PC | Trạng thái | Bằng chứng hoặc giới hạn                                                                                                                                 |
| --: | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | PASS       | Cấu trúc `backend/` gồm Gateway, 7 service, shared contracts, infra, mocks và scripts.                                                                   |
|   2 | PASS       | `.env` không được track; `.gitignore` loại secret, key, log, dependency; `.env.example` dùng placeholder.                                                |
|   3 | PARTIAL    | Gateway là entry point duy nhất, có health, request ID và chặn `/internal/*`; JWT/RBAC/rate limit mới ở lớp triển khai PC9-PC30.                         |
|   4 | PARTIAL    | Có Internal REST token và Kafka infrastructure; gRPC nghiệp vụ chưa bật đầy đủ.                                                                          |
|   5 | PASS       | Compose định nghĩa Gateway, 7 service, Kafka, Redis, PostgreSQL, MongoDB và init containers. Runtime cần chạy lại sau khi bật Docker.                    |
|   6 | PASS       | Health route và readiness code đã có; runtime evidence cũ ghi nhận `/health`, `/ready`, `/health/services` hoạt động.                                    |
|   7 | PASS       | Có 5 topic: `driver.events`, `booking.events`, `trip.events`, `payment.events`, `cab.dead-letter`; cần chạy lại broker check để xác nhận phiên hiện tại. |
|   8 | PASS       | Gateway chặn `/internal/*`; chỉ Gateway được publish host port theo Compose.                                                                             |

## 3. Trạng thái PC9-PC30

|  PC | Nội dung                   | Trạng thái hiện tại | Ghi chú                                                                                               |
| --: | -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
|   9 | Đăng ký Customer           | BLOCKED             | Route/code và smoke flow đã có; cần Docker stack để xác minh HTTP runtime.                            |
|  10 | Đăng nhập Customer         | PARTIAL             | In-process login `200`, token RS256 đã có; cần runtime Gateway evidence.                              |
|  11 | Lấy Customer theo mã       | BLOCKED             | Đã có route/ownership logic; chưa chạy qua stack.                                                     |
|  12 | Lấy Driver theo mã         | BLOCKED             | Đã có route public fields; chưa chạy qua stack.                                                       |
|  13 | Nearby Driver              | BLOCKED             | Đã có query radius/limit/page; chưa seed và chạy runtime đầy đủ.                                      |
|  14 | Danh sách Booking Customer | BLOCKED             | Đã có route/paging; persistence hiện là memory.                                                       |
|  15 | Đặt xe                     | BLOCKED             | Đã có booking/offer skeleton; chưa xác minh dispatch end-to-end.                                      |
|  16 | Driver nhận chuyến         | BLOCKED             | Đã có offer accept/assignment logic; chưa xác minh runtime.                                           |
|  17 | Cập nhật trạng thái chuyến | BLOCKED             | Đã có transition logic; chưa chạy workflow qua Gateway.                                               |
|  18 | Hủy chuyến                 | BLOCKED             | Đã có cancel route và reason validation; chưa runtime evidence.                                       |
|  19 | Thanh toán online          | BLOCKED             | Raw callback/HMAC test local đạt; payment stack và callback workflow chưa chạy.                       |
|  20 | Đánh giá chuyến đi         | BLOCKED             | Đã có review/XSS escaping logic; chưa workflow runtime.                                               |
|  21 | Đăng ký Driver             | BLOCKED             | OTP/register route và mock code đã có; chưa chạy state workflow.                                      |
|  22 | Duyệt hồ sơ Driver         | BLOCKED             | Admin approve/reject logic đã có; chưa runtime evidence.                                              |
|  23 | Availability Driver        | BLOCKED             | Online/offline/location logic đã có; chưa chạy qua Gateway.                                           |
|  24 | Encryption at rest         | NOT IMPLEMENTED     | Có helper AES-GCM/key config, nhưng dữ liệu owner chưa được lưu bền vững trong DB để kiểm tra.        |
|  25 | SQL injection              | BLOCKED             | Input validation/login rejection logic đã có; cần runtime request và DB query evidence.               |
|  26 | XSS input                  | BLOCKED             | Escaping helper và HTTP test local đã có; cần xác minh qua workflow runtime.                          |
|  27 | JWT tampering              | BLOCKED             | RS256 verification và test tamper đã có; cần runtime Gateway evidence.                                |
|  28 | Unauthorized API           | BLOCKED             | RBAC/ownership middleware đã có; cần runtime kiểm tra HTTP `403`.                                     |
|  29 | Rate limit                 | BLOCKED             | Rate limiter code đã có; cần chạy nhiều request qua Gateway để xác nhận `429`.                        |
|  30 | Replay/idempotency         | BLOCKED             | Idempotency code/smoke assertions đã có; persistence memory chưa đủ chứng minh chống replay bền vững. |

## 4. Validation đã chạy

Các lệnh sau đã đạt:

```powershell
node backend/scripts/check-contracts.js
node --test backend/gateway/tests

docker compose --env-file .env.example config --quiet
git diff --check

node --check backend/shared/jwt.js
node --check backend/shared/service-runtime.js
node --check backend/gateway/src/app.js
```

Kết quả smoke hiện tại:

```text
node backend/scripts/smoke-test.js
REQUIRES_DOCKER: Gateway is unavailable at http://localhost:8000
```

Lệnh này chưa phải lỗi nghiệp vụ; nó cho biết Gateway chưa chạy vì Docker engine chưa sẵn sàng.

## 5. Việc cần làm để hoàn tất audit

1. Mở Docker Desktop và bật Linux containers/engine.
2. Tạo local JWT keys:

```powershell
node backend/scripts/generate-jwt-keys.js
```

3. Khởi động và build toàn bộ hệ thống:

```powershell
docker compose --env-file .env up -d --build
docker compose --env-file .env ps -a
```

4. Chạy smoke suite:

```powershell
node backend/scripts/smoke-test.js
```

5. Kiểm tra Kafka topics:

```powershell
docker compose --env-file .env exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
```

6. Nối persistence owner PostgreSQL/MongoDB, migration và seed trước khi đánh giá lại PC24 và PC30.
7. Chạy lại các attack test PC25-PC29 qua Gateway và lưu status/response vào `document/tieuchi.md`.
8. Chỉ chuyển `BLOCKED` hoặc `NOT IMPLEMENTED` sang `PASS` sau khi có output runtime mới.

## 6. Kết luận audit

Hệ thống đã có nền tảng source structure, Docker Compose, Gateway, health boundary, contract validation và phần lớn route/security skeleton cho PC9-PC30. Tuy nhiên, tại thời điểm audit chưa thể kết luận PC9-PC30 đạt đầy đủ vì Docker runtime chưa chạy và persistence nghiệp vụ chưa hoàn thiện. PC24 đang thiếu thực hiện thực tế, không chỉ thiếu kiểm thử.
