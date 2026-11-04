# BẢNG CHẤM ĐIỂM PROJECT

> Cập nhật runtime mới nhất ngày 03/10/2026: đã build và chạy backend lưu PostgreSQL/MongoDB. Collection `postman/CAB-phieucham.postman_collection.json` đạt 52 request / 68 assertions; runtime audit đạt 79 checks. Xem bằng chứng cuối file và hướng dẫn `document/database-and-postman.md`. Các ghi chú memory/Docker bị chặn bên dưới là lịch sử kiểm tra trước lần cập nhật này.

| Trường     | Giá trị |
| ---------- | ------- |
| University | IUH     |
| Class      |         |
| Student ID |         |
| Fullname   |         |
| Subject    | MSA     |

---

## Bảng chấm thực hành 1

| STT | Nội dung                                                                                               | Kết quả mong đợi                                           | Max | Giảng viên chấm |
| :-: | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | :-: | :-------------: |
|  1  | Mô tả kiến trúc tổ chức source code                                                                    |                                                            |  1  |                 |
|  2  | Kiểm tra `.gitignore` và `.env` trên GitHub                                                            |                                                            |  1  |                 |
|  3  | Mô tả nhiệm vụ gateway trong hệ thống                                                                  |                                                            |  1  |                 |
|  4  | Mô tả IPC của các microservice                                                                         |                                                            |  1  |                 |
|  5  | Compose hệ thống và liệt kê các container                                                              |                                                            |  1  |                 |
|  6  | **POSTMAN: API health check**<br>_Smoke:_ Gọi endpoint `/health`, gọi `/ready`, gọi `/health/services` | Endpoint trả trạng thái healthy/ready và danh sách service |  1  |                 |
|  7  | Kiểm tra hệ thống Kafka / RabbitMQ                                                                     |                                                            |  1  |                 |
|  8  | Kiểm tra mọi request đều phải đi qua Gateway                                                           |                                                            |  1  |                 |
|  9  | **POSTMAN: Đăng ký tài khoản khách hàng**<br>_Smoke:_ Khách hàng chưa có tài khoản                     | Tài khoản được tạo; khách hàng đăng nhập được vào hệ thống |  1  |                 |
| 10  | **POSTMAN: Đăng nhập khách hàng**<br>_Smoke:_ Khách hàng đã có tài khoản đang hoạt động                | Hệ thống cấp token                                         |  1  |                 |

---

## Bảng chấm thực hành 2

| STT | Nội dung                                                                                                                                                                                  | Kết quả mong đợi                                                                                         | Max | Giảng viên chấm |
| :-: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | :-: | :-------------: |
| 11  | **POSTMAN: Lấy thông tin khách hàng với mã số**                                                                                                                                           | Sử dụng token để xem thông tin khách hàng                                                                |  1  |                 |
| 12  | **POSTMAN: Lấy thông tin tài xế với mã số**                                                                                                                                               | Sử dụng token để xem thông tin tài xế                                                                    |  1  |                 |
| 13  | **POSTMAN: Liệt kê danh sách tài xế tại khu vực**<br>_Smoke:_ Cần giả lập có sẵn ít nhất 5 tài xế có các trạng thái khác nhau                                                             | Danh sách Driver xung quanh tọa độ có bán kính 1km; danh sách có giới hạn (limit) và phân trang (paging) |  1  |                 |
| 14  | **POSTMAN: Liệt kê danh sách các booking của Customer**<br>_Smoke:_ Cần giả lập có sẵn ít nhất 5 booking                                                                                  | Danh sách Booking liên quan đến khách hàng; danh sách có giới hạn (limit) và phân trang (paging)         |  1  |                 |
| 15  | **POSTMAN: Đặt xe**<br>_Smoke:_ Khách hàng đặt xe → Hệ thống tạo booking → Hệ thống tìm tài xế gần điểm đón → Gửi offer cho tài xế                                                        | Booking được tạo; khách hàng thấy trạng thái đang tìm tài xế                                             |  1  |                 |
| 16  | **POSTMAN: Tài xế nhận chuyến**<br>_Smoke:_ Tài xế nhận thông báo có chuyến → Xem thông tin chuyến → Chấp nhận                                                                            | Ride/Trip được gán tài xế; khách hàng nhận thông tin tài xế                                              |  1  |                 |
| 17  | **POSTMAN: Cập nhật trạng thái chuyến**<br>_Smoke:_ Tài xế chuyển trạng thái đến điểm đón → Bắt đầu chuyến → Ride/Trip cập nhật vị trí di chuyển → Đến điểm kết thúc và hoàn thành chuyến | Trạng thái chuyến cập nhật đúng trình tự                                                                 |  1  |                 |
| 18  | **POSTMAN: Hủy chuyến**<br>_Smoke:_ Khách hàng chọn hủy chuyến → Cung cấp lý do → Xác nhận hủy                                                                                            | Ride/Trip chuyển sang `CANCELED`; các bên nhận thông báo                                                 |  1  |                 |
| 19  | **POSTMAN: Thanh toán online**<br>_Smoke:_ Chọn thanh toán online → Thực hiện thanh toán → Hệ thống nhận callback → Kiểm tra kết quả                                                      | Payment chuyển `COMPLETED`; chuyến được ghi nhận đã thanh toán                                           |  1  |                 |
| 20  | **POSTMAN: Đánh giá chuyến đi**<br>_Smoke:_ Khách hàng đánh giá chuyến đi (Ride/Trip) → Chọn số sao → Nhập nhận xét → Gửi đánh giá                                                        | Review được lưu và liên kết với chuyến đi                                                                |  1  |                 |

---

## Bảng chấm thực hành 3

| STT | Nội dung                                                                                                                                                                                                                                       | Kết quả mong đợi                                                                            | Max | Giảng viên chấm |
| :-: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | :-: | :-------------: |
| 21  | **POSTMAN: Đăng ký tài xế**<br>_Smoke:_ Nhập số điện thoại → Xác thực OTP → Nhập thông tin cá nhân/xe → Gửi hồ sơ                                                                                                                              | Hồ sơ tài xế được tạo ở trạng thái chờ duyệt                                                |  1  |                 |
| 22  | **POSTMAN: Duyệt hồ sơ tài xế**<br>_Smoke:_ Quản trị viên (Admin) mở danh sách hồ sơ → Xem chi tiết → Duyệt hoặc từ chối                                                                                                                       | Trạng thái hồ sơ được cập nhật; tài xế nhận kết quả                                         |  1  |                 |
| 23  | **POSTMAN: Bật/tắt trạng thái nhận chuyến**<br>_Smoke:_ Tài xế chuyển trạng thái Online / Offline → hệ thống cập nhật                                                                                                                          | Trạng thái nhận chuyến thay đổi và được hệ thống ghi nhận                                   |  1  |                 |
| 24  | **POSTMAN: Data encryption at rest**<br>_Smoke:_ Dữ liệu lưu trong DB<br>Attacker truy cập trực tiếp DB, xem dữ liệu nhạy cảm:<br>`password = 123400` → cần được mã hóa thành `password = "X9f3k2s9...encrypted..."`                           | Data nhạy cảm được mã hóa<br>Không đọc được plaintext<br>Có key management                  |  1  |                 |
| 25  | **POSTMAN: SQL injection attempt**<br>_Smoke:_ API nhận input từ user:<br>`{ "email": "' OR 1=1 --", "password": "anything" }`                                                                                                                 | Query không bị bypass<br>Không login thành công<br>Không lộ dữ liệu DB<br>HTTP 400 hoặc 401 |  1  |                 |
| 26  | **POSTMAN: XSS input test**<br>_Smoke:_ API nhận input từ user:<br>`<script>alert('hack')</script>`                                                                                                                                            | Script không được execute<br>Output được escape                                             |  1  |                 |
| 27  | **POSTMAN: JWT tampering**<br>_Smoke:_ Attacker sửa payload token:<br>`{ "sub": "user_123", "role": "USER" }` → `{ "sub": "admin_001", "role": "ADMIN" }`<br>Nếu hệ thống không kiểm tra signature → attacker thành admin                      | Token decode fail<br>HTTP 401<br>Không truy cập được API                                    |  1  |                 |
| 28  | **POSTMAN: Unauthorized API access**<br>_Smoke:_ Customer không có quyền gọi API Driver                                                                                                                                                        | HTTP 403 Forbidden<br>Không trả dữ liệu                                                     |  1  |                 |
| 29  | **POSTMAN: Rate limit attack**<br>_Smoke:_ Client gửi nhiều request liên tục<br>Attacker spam API: `POST /booking` > 1000 requests/sec                                                                                                         | HTTP 429 Too Many Requests<br>Rate limit hoạt động<br>Không làm sập hệ thống                |  1  |                 |
| 30  | **POSTMAN: Replay attack (idempotency)**<br>_Smoke:_ Attacker gửi lại request cũ (request payment cũ)<br>Request gốc: `{ "user_id": "USR123", "amount": 50000 }`<br>Attacker gửi lại request y hệt: `{ "user_id": "USR123", "amount": 50000 }` | Không xử lý lại transaction<br>Không bị double charge<br>Trả response cũ                    |  1  |                 |

---

## Bằng chứng triển khai PC1-PC8 (Infrastructure Gate)

Ngày kiểm tra: 02/10/2026. Phạm vi chỉ là source/Compose/infrastructure/health/network boundary; PC9-PC30 chưa triển khai.

| PC  | Trạng thái | Bằng chứng thực thi / giới hạn                                                                                                                                                                                                               |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC1 | PASS       | Toàn bộ implementation nằm dưới `backend/`: Gateway, 7 service độc lập, shared runtime và infra; mỗi bounded context giữ cấu trúc `api/application/domain/infrastructure`, không có cross-service database access.                           |
| PC2 | PASS       | `git status --short` không có `.env` tracked; `.gitignore` loại `.env`, secrets, logs, build/dependencies; `.env.example` chứa placeholder, không chứa secret runtime.                                                                       |
| PC3 | PARTIAL    | Gateway là host entry point duy nhất, có route map, request ID forwarding, aggregate health và chặn `/internal/*`. Runtime là Node.js/Express; JWT verification, RBAC và Redis rate limiter nghiệp vụ được giữ cho PC9-PC30.                 |
| PC4 | PARTIAL    | Gateway gọi các service qua HTTP nội bộ với `X-Service-Token`; service `/ready` và `/internal/*` yêu cầu token. gRPC không được bật trong skeleton JavaScript; IPC nghiệp vụ thuộc PC9-PC30.                                                 |
| PC5 | PASS       | `docker compose ps -a`: 12 container long-running healthy/running (`gateway`, 7 service, Kafka, Redis, PostgreSQL, MongoDB) và `kafka-init`/`mongo-init` `Exited (0)`; chỉ Gateway publish `8000`.                                           |
| PC6 | PASS       | Qua Gateway: `/health` `200`, `/ready` `200`, `/health/services` `200`, đủ 7 service và dependency state. Khi stop Redis, `/ready` `503`; sau start Redis, `/ready` `200`.                                                                   |
| PC7 | PASS       | Kafka healthy; `kafka-topics.sh --list` trả `driver.events`, `booking.events`, `trip.events`, `payment.events`, `cab.dead-letter`; broker connectivity và topic init đã chạy. Producer/consumer nghiệp vụ chưa thuộc gate này.               |
| PC8 | PASS       | Request `/auth/login` đi qua Gateway và trả response skeleton từ `identity-service`; `/internal/accounts/drivers` qua host Gateway trả `404`; kiểm tra host ports `3000-3006`, `50051`, `5432`, `6379`, `9092`, `27017` đều không reachable. |

Các kết quả PASS ở trên chỉ áp dụng cho bằng chứng runtime của hạ tầng tương ứng; không suy ra các workflow backend PC9-PC30 đã hoàn thành.

## Evidence PC9-PC30 cập nhật 03/10/2026

- Syntax, contract JSON, `node --test backend/gateway/tests` (2 tests) và `docker compose --env-file .env.example config --quiet`: `PASS`.
- `node backend/scripts/smoke-test.js`: `REQUIRES_DOCKER`, exit code `2`, vì Gateway chưa chạy tại `http://localhost:8000`.
- `docker compose --env-file .env.example up -d --build`: bị chặn bởi `npipe:////./pipe/dockerDesktopLinuxEngine` không tồn tại; Docker Desktop Linux engine chưa chạy.
- JWT dùng RS256 từ `JWT_*_KEY_PATH` hoặc env inline; `.secrets/` bị ignore. Payment callback verify HMAC trên raw bytes trước khi parse; test HTTP qua Gateway `PASS`.
- Runtime khai báo `STORAGE_MODE=memory`, `durable=false`; PC24 durable persistence chưa triển khai và không được ghi `PASS`.

## Cập nhật PC9-PC30 ngày 03/10/2026

Đã bổ sung route/workflow owner trong `backend/shared/service-runtime.js`, JWT/RBAC/rate-limit và header forwarding tại Gateway, smoke HTTP tại `backend/scripts/smoke-test.js`, biến môi trường trong Compose và hướng dẫn request đầy đủ trong `document/tieuchi.md`. Kiểm tra tĩnh đạt: toàn bộ JavaScript backend `node --check`, `node scripts/check-contracts.js`, `docker compose --env-file .env.example config --quiet`, `git diff --check`, Python runtime scan (loại `node_modules`) và in-process identity login `200` có token.

PC9-PC30 chưa ghi PASS runtime trong evidence này vì `docker compose --env-file .env.example up -d --build` bị chặn bởi Docker Desktop Linux engine chưa chạy (`dockerDesktopLinuxEngine` pipe không tồn tại). Cần bật Docker và chạy lại smoke suite qua `http://localhost:8000` trước khi chuyển các tiêu chí sang PASS.

## Bằng chứng runtime sau khi nối database — 03/10/2026

Lần kiểm tra này thay thế kết luận bị chặn/memory của các lần trước:

| Phạm vi | Kết quả thực thi |
| --- | --- |
| Build và chạy Compose | Gateway + 7 service hoạt động; PostgreSQL/MongoDB lưu dữ liệu nghiệp vụ |
| PC6, PC8–PC23, PC25–PC30 | Collection Postman: 52 requests, 68 assertions, 0 failures |
| Kiểm tra âm và ownership | Runtime audit: 79 checks, 0 failures |
| PC24 | Password scrypt có salt; giấy tờ AES-GCM trong PostgreSQL; khóa nằm ngoài DB tại `.secrets/field-encryption.key` |
| PC22 nhánh từ chối | Hồ sơ REJECTED, không bật online được, có thông báo cho tài xế |
| PC29 | 1005 request đồng thời: 5 request body không hợp lệ trả 400, 1000 request bị giới hạn trả 429; Gateway vẫn ready |
| PC30 qua restart | Restart cả 7 service rồi gửi 12 payment replay đồng thời: cùng response đã lưu, số payment không tăng |
| pgAdmin 4 / Compass | Kết nối host tới 6 PostgreSQL database và MongoDB thành công; thông báo còn sau restart |

Chạy lại bằng `node backend/scripts/run-postman.js`, `node backend/tests-audit/runtime-audit.mjs`, `node backend/scripts/verify-database.js` và `node backend/scripts/verify-attacks.js`; chờ 60 giây giữa các suite HTTP để không dùng chung cửa sổ rate limit. Hướng dẫn import Postman, secret callback, truy vấn PC24 và kiểm thử restart nằm trong `document/database-and-postman.md`.

Phạm vi kết quả là backend thực hành với thanh toán/SMS sandbox. Kafka đã có hạ tầng, workflow hiện giao tiếp HTTP; chưa đánh giá production load hay atomicity xuyên nhiều service. PC8 vẫn chặn truy cập trực tiếp service nghiệp vụ; cổng DB được mở riêng trên `127.0.0.1` theo yêu cầu dùng công cụ quản trị.
