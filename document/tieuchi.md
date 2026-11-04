# Hướng dẫn kiểm tra tiêu chí 1-8

Tài liệu này hướng dẫn chạy và ghi nhận bằng chứng cho **Bảng chấm thực hành 1**, tiêu chí 1 đến 8 của CAB System.

## 0. Chuẩn bị

Thực hiện tại thư mục gốc repository:

```powershell
Set-Location D:\Nam4\HK1\Lap_trinh_huong_DV\ThucHanh_Repo\23659411_HuynhHuuTuan_CABsystem
```

Yêu cầu:

- Docker Desktop đang chạy.
- Docker Compose v2.
- Node.js 20 trở lên.
- File `.env` tồn tại. Nếu chưa có, tạo từ `.env.example` và thay các giá trị secret local:

```powershell
Copy-Item .env.example .env
```

Kiểm tra cấu hình và cài dependency workspace:

```powershell
docker compose --env-file .env config --quiet
Push-Location backend
npm ci
npm run check:syntax
Pop-Location
```

Khởi động hệ thống:

```powershell
docker compose --env-file .env up -d --build
docker compose --env-file .env ps -a
```

Dừng hệ thống sau khi kiểm tra:

```powershell
docker compose --env-file .env down
```

> Không commit `.env`, private key, secret, `node_modules` hoặc dữ liệu volume lên GitHub.

---

## 1. Mô tả kiến trúc tổ chức source code

### Cách kiểm tra

```powershell
Get-ChildItem backend -Directory
Get-ChildItem backend\gateway\src -Recurse -File
Get-ChildItem backend\services -Directory
Get-ChildItem backend\services -Recurse -Directory | Select-Object FullName
```

Kiểm tra kiến trúc theo các nhóm chính:

- `backend/gateway`: điểm vào REST/HTTPS duy nhất.
- `backend/services/*`: 7 bounded-context service.
- `backend/shared/contracts`: contract versioned, event, error và proto.
- `backend/infra`: PostgreSQL, MongoDB, Kafka initialization.
- `backend/mocks`: fixture provider.
- `backend/scripts`: seed, smoke test, contract check.
- Mỗi service có các lớp `api`, `application`, `domain`, `infrastructure`.

### Kết quả đạt

Source code nằm trong `backend/`, được tách theo Gateway, service, contract và hạ tầng. Mỗi service sở hữu domain và database của mình; không import domain hoặc repository của service khác.

Bằng chứng có thể chụp:

```powershell
Get-ChildItem backend -Recurse -Directory | Select-Object FullName
```

---

## 2. Kiểm tra `.gitignore` và `.env` trên GitHub

### Kiểm tra file nhạy cảm không được track

```powershell
git check-ignore -v .env backend\node_modules\app.log
if (git ls-files .env) { throw '.env dang bi track' }
git ls-files | Select-String '\.env$|\.pem$|\.key$|node_modules|\.log$'
```

Kiểm tra các biến mẫu:

```powershell
Get-Content .env.example
Get-ChildItem backend -Recurse -Filter .env.example | Get-Content
```

Kiểm tra danh sách file đã commit trên GitHub tương ứng với branch hiện tại:

```powershell
git ls-files .env
 git ls-files | Select-String '\.env$|\.pem$|\.key$'
```

### Kết quả đạt

- `.env` không xuất hiện trong `git ls-files`.
- Secret, key, log và `node_modules` bị `.gitignore` loại trừ.
- `.env.example` chỉ chứa tên biến và placeholder an toàn.
- Không có password hoặc token thật trong source, Compose, README hay tài liệu evidence.

---

## 3. Mô tả và kiểm tra Gateway

Gateway là public HTTP boundary, chạy tại `http://localhost:8000`. Gateway chịu trách nhiệm health aggregate, request ID, route boundary và chặn internal route. Gateway không chứa domain business.

### Kiểm tra container và port public

```powershell
docker compose --env-file .env ps gateway
Test-NetConnection localhost -Port 8000
```

Chỉ kết quả `8000` được phép truy cập từ host. Các port service và database là network nội bộ Compose.

### Kiểm tra route Gateway

```powershell
Invoke-WebRequest http://localhost:8000/health | Select-Object StatusCode, Content
Invoke-WebRequest http://localhost:8000/ready | Select-Object StatusCode, Content
Invoke-WebRequest http://localhost:8000/health/services | Select-Object StatusCode, Content
```

### Kết quả đạt

- Gateway ở trạng thái `healthy`.
- Client truy cập qua Gateway, không truy cập trực tiếp service.
- `/health`, `/ready`, `/health/services` được Gateway xử lý.
- `/internal/*` không được public route chuyển tiếp.

---

## 4. Mô tả IPC giữa các microservice

Kiểm tra theo thiết kế:

| Kênh                                 | Mục đích                                         | Kiểm tra                                        |
| ------------------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| Client -> Gateway                    | REST/HTTPS public API                            | `http://localhost:8000`                         |
| Gateway -> service                   | gRPC theo contract khi nghiệp vụ được triển khai | Contract trong `backend/shared/contracts/proto` |
| Service -> service                   | Internal REST có service token                   | Endpoint `/internal/*` trong owner service      |
| Service -> Kafka                     | Publish/subscribe event bất đồng bộ              | Kafka topics và consumer groups                 |
| Gateway/Driver/Booking/Trip -> Redis | Rate limit, GEO, TTL, cache/lease                | Container `redis`                               |

Kiểm tra contract và code structure:

```powershell
Push-Location backend
node scripts/check-contracts.js
Get-ChildItem shared\contracts -Recurse -File
Get-ChildItem gateway\src\grpc -Recurse -File
Get-ChildItem services -Recurse -Filter '*client.js'
Pop-Location
```

Kiểm tra các mạng/container:

```powershell
$network = (docker network inspect cab-internal | ConvertFrom-Json)[0]

$network.Containers.PSObject.Properties.Value |
    Format-Table Name, IPv4Address

```

### Kết quả đạt

Các service chỉ giao tiếp qua kênh đã được thiết kế; không dùng database chung để đọc/ghi chéo service. PC1-PC8 mới kiểm tra boundary và readiness; business RPC/internal workflow đầy đủ thuộc PC9-PC30.

---

## 5. Compose hệ thống và danh sách container

### Kiểm tra cấu hình

```powershell
docker compose --env-file .env config --quiet
```

### Khởi động và xem container

```powershell
docker compose --env-file .env up -d --build
docker compose --env-file .env ps -a
```

Danh sách container P1 phải có:

- `gateway`
- `identity-service`
- `customer-service`
- `driver-service`
- `booking-service`
- `trip-service`
- `payment-service`
- `notification-service`
- `postgres`
- `mongodb`
- `redis`
- `kafka`
- `mongo-init` và `kafka-init` chạy hoàn tất với mã `0`

Kiểm tra nhanh trạng thái:

```powershell
docker compose --env-file .env ps --format json
```

### Kết quả đạt

Tám container ứng dụng/hạ tầng chính ở trạng thái `running` và `healthy` nếu có healthcheck. Hai init container có thể hiển thị `Exited (0)` sau khi hoàn thành bình thường. Chỉ Gateway publish port host.

---

## 6. POSTMAN: API health check

Base URL:

```text
http://localhost:8000
```

Tạo ba request trong Postman:

| Method | URL                           | Expected                                      |
| ------ | ----------------------------- | --------------------------------------------- |
| GET    | `{{baseUrl}}/health`          | HTTP `200`, trạng thái `healthy`              |
| GET    | `{{baseUrl}}/ready`           | HTTP `200`, trạng thái `ready`                |
| GET    | `{{baseUrl}}/health/services` | HTTP `200`, danh sách 7 service và dependency |

Có thể chạy nhanh bằng PowerShell:

```powershell
foreach ($path in '/health','/ready','/health/services') {
  try {
    $response = Invoke-WebRequest -Uri ("http://localhost:8000" + $path) -Method Get
    "{0} {1} {2}" -f $path, [int]$response.StatusCode, $response.Content
  } catch {
    "{0} ERROR {1}" -f $path, $_.Exception.Message
  }
}
```

Hoặc dùng smoke script:

```powershell
Push-Location backend
node scripts/smoke-test.js
Pop-Location
```

### Kiểm tra readiness phụ thuộc

```powershell
docker compose --env-file .env stop redis
Invoke-WebRequest http://localhost:8000/ready -SkipHttpErrorCheck | Select-Object StatusCode, Content
docker compose --env-file .env start redis
```

Sau khi Redis hoạt động lại, `/ready` phải trở về `200`.

---

## 7. Kiểm tra Kafka / RabbitMQ

Thiết kế CAB System dùng **Kafka**, không dùng RabbitMQ làm broker P1.

### Kiểm tra Kafka container

```powershell
docker compose --env-file .env ps kafka kafka-init
```

### Liệt kê topic

```powershell
docker compose --env-file .env exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
```

Các topic P1 cần có:

```text
booking.events
driver.events
trip.events
payment.events
cab.dead-letter
```

Kiểm tra chi tiết topic:

```powershell
docker compose --env-file .env exec -T kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --describe
```

Kiểm tra log broker và init:

```powershell
docker compose --env-file .env logs --no-color kafka kafka-init
```

### Kết quả đạt

Kafka healthy, năm topic P1 tồn tại, broker nhận kết nối và `kafka-init` hoàn tất. Không cần tạo RabbitMQ container.

---

## 8. Kiểm tra mọi request đi qua Gateway

### Kiểm tra Gateway route public

```powershell
Invoke-WebRequest http://localhost:8000/health | Select-Object StatusCode
```

### Kiểm tra internal route bị chặn

```powershell
try {
  Invoke-WebRequest http://localhost:8000/internal/accounts/drivers -Method Get -ErrorAction Stop
} catch {
  [int]$_.Exception.Response.StatusCode
}
```

Kết quả phải là `404` hoặc mã chặn tương đương theo contract.

### Kiểm tra port nội bộ không public

```powershell
foreach ($port in 3000,3001,3002,3003,3004,3005,3006,5432,6379,9092,27017) {
  $result = Test-NetConnection localhost -Port $port -WarningAction SilentlyContinue
  "host-port {0}: {1}" -f $port, $result.TcpTestSucceeded
}
```

Các port trên phải có `False`; port `8000` của Gateway phải là port public duy nhất.

### Kết quả đạt

- Client chỉ gọi public endpoint qua Gateway.
- Gateway chặn `/internal/*`.
- Service, database, Redis và Kafka không expose port trực tiếp ra host.
- Internal service-to-service traffic chỉ chạy trong network `cab-internal` và dùng cơ chế xác thực nội bộ.

---

## Bảng tổng hợp bằng chứng

| Tiêu chí | Bằng chứng cần lưu                                               | Trạng thái |
| -------: | ---------------------------------------------------------------- | ---------- |
|        1 | Cây thư mục `backend/`, phân chia Gateway/service/contract/infra | Chưa chấm  |
|        2 | `git check-ignore`, `git ls-files`, `.env.example`               | Chưa chấm  |
|        3 | Gateway healthy, port `8000`, route health                       | Chưa chấm  |
|        4 | Contract, network `cab-internal`, IPC mapping                    | Chưa chấm  |
|        5 | `docker compose config`, `docker compose ps -a`                  | Chưa chấm  |
|        6 | Postman hoặc smoke output của 3 endpoint health                  | Chưa chấm  |
|        7 | Kafka health, topic list, log broker/init                        | Chưa chấm  |
|        8 | `/internal/*` bị chặn và port nội bộ không public                | Chưa chấm  |

Sau khi có output thực tế, cập nhật cột `Giảng viên chấm` và phần kết quả trong `phieucham.md`. Không đánh dấu đạt chỉ dựa trên cấu hình tĩnh nếu chưa có bằng chứng runtime.

---

## Hướng dẫn kiểm thử PC9-PC30

### Chuẩn bị, reset và seed

Chạy tại thư mục gốc, sau khi Docker Desktop đã bật Linux engine:

```powershell
Copy-Item .env.example .env -Force
docker compose --env-file .env config --quiet
docker compose --env-file .env down -v
docker compose --env-file .env up -d --build
docker compose --env-file .env ps -a
Push-Location backend
npm ci
node scripts/check-contracts.js
node scripts/smoke-test.js
Pop-Location
```

Credential local/demo trong `.env.example`: `customer@cab.local` / `Customer123!`, `driver@cab.local` / `Driver123!`, `admin@cab.local` / `Admin123!`. Client chỉ gọi `http://localhost:8000`; không gọi trực tiếp service/database. Sau login dùng `Authorization: Bearer <accessToken>`. Lệnh ghi cần `Idempotency-Key: pc-<số>-<uuid>` theo YAML.

### PC9-PC14

| PC  | Request chính                                                                                                                                                                                        | Expected                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 9   | `POST /auth/register`, `Content-Type: application/json`, `Idempotency-Key: pc9-1`; body `{ "fullName":"Test Customer", "email":"new@cab.local", "phone":"+84909999999", "password":"Customer123!" }` | `201`, có `customerId`,`userId`; login được.                                            |
| 10  | `POST /auth/login`, body `{ "email":"customer@cab.local", "password":"Customer123!" }`                                                                                                               | `200`, có `accessToken`,`tokenType`,`expiresIn`,`role=CUSTOMER`,`accountStatus=ACTIVE`. |
| 11  | `GET /customers/10000000-0000-4000-8000-000000000001`, Bearer CUSTOMER                                                                                                                               | `200`, có `id`,`fullName`,`email`,`phone`,`createdAt`; customer khác `403`.             |
| 12  | `GET /drivers/20000000-0000-4000-8000-000000000001`, Bearer CUSTOMER                                                                                                                                 | `200`, chỉ public fields; không có CCCD/GPLX plaintext.                                 |
| 13  | `GET /drivers/nearby?lat=10.7735&lng=106.699&radius=1000&page=1&limit=2`, Bearer CUSTOMER                                                                                                            | `200`, driver `ONLINE`, `distanceM <= 1000`, có `items/page/limit/total`.               |
| 14  | `GET /bookings?page=1&limit=2`, Bearer CUSTOMER                                                                                                                                                      | `200`, chỉ booking của JWT customer và có phân trang.                                   |

### PC15-PC20

1. `POST /fare-estimates`, Bearer CUSTOMER, body `{ "pickup":{"lat":10.7735,"lng":106.699}, "dropoff":{"lat":10.7800,"lng":106.710}, "vehicleType":"BIKE" }` -> `200`, có `estimatedFareVnd`,`distanceM`,`etaMinutes`.
2. `POST /bookings`, Bearer CUSTOMER, `Idempotency-Key: pc15-1`, body pickup/dropoff/vehicleType -> `201`, `bookingId`, `status=SEARCHING`; `GET /bookings` thấy offer dispatch.
3. Driver `GET /offers`, rồi `POST /offers/{offerId}/accept`, Bearer DRIVER, `Idempotency-Key: pc16-1`, body `{}` -> `200`, có `bookingId`,`tripId`,`driverId`,`status=ASSIGNED`.
4. Driver lần lượt `PATCH /trips/{tripId}/status`, body `{ "status":"ARRIVED" }`, `{ "status":"IN_PROGRESS" }`, `{ "status":"COMPLETED" }` -> `200`; nhảy bước -> `409`. `PUT /drivers/me/location`, body `{ "lat":10.774,"lng":106.700 }` -> `200`.
5. Khi booking `SEARCHING`: `POST /bookings/{bookingId}/cancel`, Bearer CUSTOMER, key `pc18-1`, body `{ "reason":"changed plan" }` -> `200`,`CANCELED`. Với trip `ASSIGNED/ARRIVED`: `POST /trips/{tripId}/cancel`, Bearer owner, key, body `{ "reason":"cannot wait" }` -> `200`,`CANCELED`; `IN_PROGRESS` -> `409`.
6. Sau trip `COMPLETED`: `POST /payments`, Bearer CUSTOMER, key `pc19-payment`, body `{ "tripId":"<tripId>", "method":"ONLINE" }` -> `201`,`PENDING`, amount do server lấy từ Trip. `POST /payments/{paymentId}/sandbox-confirm`, Bearer CUSTOMER, key `pc19-confirm`, body `{ "scenario":"SUCCESS" }` -> `200`,`result=COMPLETED`; GET payment -> `COMPLETED`.
7. `POST /trips/{tripId}/reviews`, Bearer CUSTOMER, key `pc20-1`, body `{ "stars":5,"comment":"Tai xe than thien" }` -> `201`; GET review -> `200`. Comment `<script>alert(1)</script>` phải trả escaped.

### PC21-PC23

1. `POST /drivers/otp/request`, body `{ "phone":"+84908888888","purpose":"DRIVER_REGISTRATION" }` -> `202`, lấy `challengeId` và `otpCode` ngẫu nhiên trong sandbox. `POST /drivers/otp/verify`, body `{ "challengeId":"<id>","phone":"+84908888888","code":"<otpCode>" }` -> `200`, lấy `registrationToken`.
2. `POST /drivers/register`, `Authorization: Bearer <registrationToken>`, key `pc21-1`, body `{ "fullName":"New Driver","phone":"+84908888888","password":"Driver123!","citizenId":"079012345678","licenseNumber":"B2-123456","vehicleType":"BIKE","plate":"59A9-99999" }` -> `201`,`PENDING_APPROVAL`. `GET /drivers/me/application` -> `200` pending.
3. Admin `GET /admin/drivers?status=PENDING_APPROVAL&page=1&limit=20`, `GET /admin/drivers/{id}`, rồi `POST /admin/drivers/{id}/approve`, key `pc22-1`, body `{}` -> `200`,`OFFLINE`. Reject hồ sơ khác bằng `POST /admin/drivers/{id}/reject`, body `{ "reason":"document mismatch" }` -> `200`,`REJECTED`.
4. Driver đã duyệt `PUT /drivers/me/availability`, body `{ "status":"ONLINE" }` rồi `OFFLINE` -> `200`; `PUT /drivers/me/location`, body tọa độ hợp lệ -> `200`; driver chưa duyệt -> `403`.

### PC24-PC30

| PC  | Request/attack                                                                      | Expected                                                                                                        |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 24  | `docker compose exec postgres psql ...` kiểm tra password/CCCD/GPLX sau PC21        | Password là hash; giấy tờ không trả plaintext API; key chỉ lấy từ env, không tracked.                           |
| 25  | `POST /auth/login` body `{ "email":"' OR 1=1 --","password":"anything" }`           | `401`, không bypass/không lộ SQL.                                                                               |
| 26  | Gửi `fullName`/`comment` `<script>alert(1)</script>`, sau đó GET resource           | `200`, output `&lt;script&gt;`, không executable.                                                               |
| 27  | Sửa payload JWT CUSTOMER thành ADMIN nhưng giữ signature, gọi `GET /admin/drivers`  | `401`.                                                                                                          |
| 28  | Customer gọi `PUT /drivers/me/availability` hoặc `POST /admin/drivers/{id}/approve` | `403`, không side effect. YAML vẫn cho phép Customer đọc public fields `GET /drivers/{id}`.                     |
| 29  | Gửi hơn 5 `POST /bookings`/phút/user, mỗi request key khác                          | `429` và `Retry-After`; login quá 10/phút cũng `429`.                                                           |
| 30  | Lặp `POST /payments` cùng body/key; rồi cùng key với body khác                      | Response payment cũ, không tạo charge thứ hai; body khác `422`. Lặp sandbox/callback không tạo side effect mới. |

Thứ tự bắt buộc: PC15 -> PC16 -> PC17 -> PC19 -> PC20; PC21 OTP -> register -> PC22 approve -> PC23 online. Các body chưa có schema đầy đủ do `x-todo` dùng DTO nhỏ nhất: availability/location/status/cancel/sandbox trả trạng thái hiện tại; INT-07 không có active trip trả `404`; `scope` là array và `expiresIn` là giây. Runtime hiện dùng Internal REST adapter theo ràng buộc triển khai, dù micro design 3.7 mô tả gRPC Gateway-to-service; đây là assumption cần thay bằng proto clients khi hoàn thiện.

### Evidence hiện tại

`node --check backend/shared/service-runtime.js`, `node --check backend/gateway/src/app.js`, `node scripts/check-contracts.js` và `docker compose --env-file .env.example config --quiet` đã chạy đạt. `docker compose --env-file .env.example up -d --build` chưa chạy được vì Docker Desktop Linux engine không hoạt động (`dockerDesktopLinuxEngine` pipe không tồn tại), nên PC9-PC30 chưa được đánh dấu PASS runtime. Sau khi bật Docker, chạy lại phần Chuẩn bị và lưu output `docker compose ps -a` cùng `node backend/scripts/smoke-test.js`.

### Trạng thái thực thi PC9-PC30 ngày 03/10/2026

Các lệnh local không cần Docker:

```powershell
node --check backend/shared/jwt.js
node --check backend/shared/service-runtime.js
node --check backend/gateway/src/app.js
node backend/scripts/check-contracts.js
node --test backend/gateway/tests
docker compose --env-file .env.example config --quiet
```

Các lệnh trên đều `PASS`. Test callback dùng HTTP thật qua Gateway; test route đọc trực tiếp OpenAPI YAML. `node backend/scripts/smoke-test.js` trả `REQUIRES_DOCKER` và exit code `2` khi Gateway chưa chạy. Runtime cần `node backend/scripts/generate-jwt-keys.js`, `docker compose --env-file .env.example up -d --build`, rồi `node backend/scripts/smoke-test.js`.

| PC  | Trạng thái                      | Lệnh kiểm tra chính                                       | Expected/result                                                                          |
| --- | ------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 9   | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Register `201`, login lại được.                                                          |
| 10  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Login `200`, token RS256.                                                                |
| 11  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Customer GET `200`, khác chủ `403`.                                                      |
| 12  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Driver GET `200`, không lộ giấy tờ.                                                      |
| 13  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Nearby có radius và paging.                                                              |
| 14  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Booking list theo owner và paging.                                                       |
| 15  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Booking `201`, có offer dispatch.                                                        |
| 16  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Accept tạo trip.                                                                         |
| 17  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Status transition tuần tự.                                                               |
| 18  | requires Docker                 | `curl -X POST http://localhost:8000/bookings/{id}/cancel` | Route có; cần workflow runtime.                                                          |
| 19  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Payment workflow cần stack; raw callback HTTP test `PASS`.                               |
| 20  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Review/escaping cần workflow runtime.                                                    |
| 21  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | OTP/register driver cần state service.                                                   |
| 22  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Admin approve/reject cần state service.                                                  |
| 23  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Availability/location cần state service.                                                 |
| 24  | not implemented/document x-todo | `docker compose exec postgres psql ...`                   | Durable owner persistence chưa nối; runtime báo `persistence.mode=memory,durable=false`. |
| 25  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Injection input không bypass, login `401`.                                               |
| 26  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | XSS output escaped qua HTTP.                                                             |
| 27  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | JWT tampering `401`; RS256 helper đã có.                                                 |
| 28  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Unauthorized driver command `403`.                                                       |
| 29  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Rate limit `429` và `Retry-After`.                                                       |
| 30  | requires Docker                 | `node backend/scripts/smoke-test.js`                      | Replay trả response cũ, body đổi `422`.                                                  |

---

# CAB System Backend Runtime/Security Audit — 03/10/2026

## Phạm vi và phương pháp

Audit độc lập này chỉ kiểm tra `backend/` bằng Docker Desktop Linux engine. Source nghiệp vụ không được sửa. Các file duy nhất được thêm để kiểm thử nằm trong `backend/tests-audit/`.

Stack chuẩn được chạy trước bằng:

```powershell
node backend/scripts/generate-jwt-keys.js
docker compose --env-file .env up -d --build
docker compose --env-file .env ps -a
```

Build thành công nhưng Gateway chuẩn thoát mã `1` vì image không có `/app/shared/jwt.js`. Sau đó, để tiếp tục kiểm thử logic mà không sửa source/Compose chính, audit dùng override sau:

```powershell
docker compose --env-file .env -f docker-compose.yml -f backend/tests-audit/docker-compose.audit.yml up -d --force-recreate
node backend/tests-audit/runtime-audit.mjs
```

Override chỉ mount `backend/shared` read-only vào Gateway và truyền hai đường dẫn key đã mount sẵn. Các PASS nghiệp vụ dưới đây là bằng chứng runtime Docker qua Gateway với override này; chúng không xóa hai lỗi packaging/configuration của stack chuẩn ở PC5/PC6.

## Kết quả PC1–PC30

| PC | Trạng thái cũ | Trạng thái mới | Lệnh/Request | Kết quả thực tế (status + trích response/log) | Kết luận & ghi chú |
| --- | --- | --- | --- | --- | --- |
| PC1 | PARTIAL | PASS | `Test-Path` cho Gateway, 7 service, `shared/contracts`, `infra`, `mocks`, `scripts` | 12/12 đường dẫn trả `True`; `node backend/scripts/check-contracts.js` exit `0`, `contract JSON: PASS` | Cấu trúc backend đủ phạm vi yêu cầu. |
| PC2 | PARTIAL | PASS | `git ls-files \| Select-String '^\.env$'`; kiểm tra `.gitignore`, `.env.example` | `.env` không được track; ignore có `.env`, `*.pem`, `*.key`, `node_modules`, `*.log`; file mẫu dùng giá trị local/placeholder | Không phát hiện secret/key được track; nội dung secret không được in. |
| PC3 | PARTIAL | FAIL | `node backend/tests-audit/runtime-audit.mjs` | `/internal/health` `404`; JWT/RBAC/rate limit hoạt động; request `/health` gửi `X-Request-ID: audit-fixed-id` nhưng response header là `null` | Thiếu propagation/response `X-Request-ID`. |
| PC4 | PARTIAL | PARTIAL | `docker compose ... exec -T gateway node -e "fetch('http://identity-service:3000/ready',...)"` | Thiếu token `401 {"error":"unauthorized"}`; token sai cũng `401`; Internal REST được dùng | Internal auth đạt. gRPC nghiệp vụ chưa bật nên chưa thể PASS đầy đủ IPC thiết kế. |
| PC5 | PARTIAL | FAIL | `docker compose --env-file .env up -d --build`; `docker compose ... ps -a` | Build exit `0`; 7 service/infra healthy và init exit `0`, nhưng `gateway Exited (1)` | Image Gateway thiếu `shared/jwt.js`; stack chuẩn không chạy hoàn chỉnh. |
| PC6 | PARTIAL | FAIL | `curl.exe -i http://localhost:8000/{health,ready,health/services}` | Stack chuẩn: cả ba lệnh `curl` exit `7`. Với audit override: cả ba trả `200`, `/ready` báo 7/7 service `up` | Tiêu chí triển khai chuẩn FAIL; logic health chỉ đạt khi có override. |
| PC7 | PARTIAL | PASS | `docker compose ... kafka-topics.sh ... --list` | Exit `0`; có đủ `driver.events`, `booking.events`, `trip.events`, `payment.events`, `cab.dead-letter` | Topic tồn tại. Runtime event được đánh giá riêng ở các PC nghiệp vụ. |
| PC8 | PARTIAL | PASS | `curl.exe --max-time 2 http://localhost:3000..3006/health`; `GET /internal/health`; `docker compose config` | Port 3000–3006 đều `http=000`, curl exit `28`; `/internal/*` trả `404`; config chỉ publish `8000` | Boundary host/network đạt. |
| PC9 | BLOCKED | PASS | `node backend/tests-audit/runtime-audit.mjs` | Register `201`; thiếu field `400`; duplicate `409`; login tài khoản mới `200` | Happy/negative path đạt qua Gateway audit. |
| PC10 | BLOCKED | PASS | `POST /auth/login`, decode JWT header | Đúng mật khẩu `200`; sai/thiếu mật khẩu `401`; header `{"alg":"RS256","typ":"JWT"}` | Đăng nhập và RS256 đạt. Token không được ghi vào báo cáo. |
| PC11 | BLOCKED | PASS | `GET /customers/{id}` | Owner `200`; IDOR `403`; không tồn tại `404`; thiếu token `401` | Ownership đạt. |
| PC12 | BLOCKED | PASS | `GET /drivers/{id}` bằng Customer | `200` chỉ có `id/fullName/vehicleType/plate/status`; không có phone/citizenId/license; nonexistent `404`; no-token `401` | Public projection đạt. |
| PC13 | BLOCKED | FAIL | `GET /drivers/nearby?lat=10.7735&lng=106.699&radius=1000&page=1&limit=2` | Happy path `404 DRIVER_NOT_FOUND`; input tọa độ sai cũng `404` thay vì `400` | `/drivers/:id` được khai báo trước `/drivers/nearby`, nuốt route tĩnh. |
| PC14 | BLOCKED | PASS | `GET /bookings?page=1&limit=2` | `200 {items:[],page:1,limit:2,total:0}`; nonexistent `404`; no-token `401` | Paging/ownership cơ bản đạt. |
| PC15 | BLOCKED | PARTIAL | `POST /bookings`, sau đó `GET /offers` | Booking `201`, offer được tạo; thiếu field `400`; role Driver `403`; nhưng `booking.events` offsets đều `0` | REST/dispatch đạt, không có Kafka event. |
| PC16 | BLOCKED | PARTIAL | `POST /offers/{id}/accept` | Happy `200` tạo `tripId`; nonexistent `404`; Customer `403`; `booking.events` và `trip.events` vẫn offset `0` | Workflow đồng bộ đạt; thiếu event evidence/producer. |
| PC17 | BLOCKED | PARTIAL | `PATCH /trips/{id}/status` | `ARRIVED`, `IN_PROGRESS`, `COMPLETED` đều `200`; skip state `409`; nonexistent `404`; sai role `403`; `trip.events` offset `0` | State machine đạt, không publish event. |
| PC18 | BLOCKED | PARTIAL | `POST /bookings/{id}/cancel`, `POST /trips/{id}/cancel` | Booking cancel hợp lệ `200 CANCELED`; thiếu reason `400`; trip thiếu reason `400`; event offsets không đổi | Validation/flow đạt, thiếu event. |
| PC19 | BLOCKED | PARTIAL | `POST /payments`; raw callback có/không HMAC | Payment `201`; method sai `400`; callback thiếu/sai chữ ký `401`; HMAC đúng `200 COMPLETED`; duplicate `200 SUCCESS`; `payment.events` offset `0` | Raw-body/HMAC/idempotent callback đạt; thiếu event. |
| PC20 | BLOCKED | PARTIAL | `POST /trips/{id}/reviews` | Review `201`, comment được escape; stars `9` trả `400`; wrong owner `403`; `trip.events` offset `0` | Logic review đạt; chưa có event. |
| PC21 | BLOCKED | FAIL | OTP request/verify rồi `POST /drivers/register` | OTP `202`; OTP sai `422`; verify `200`; register hợp lệ `201`; nhưng body `{}` không token vẫn trả `201 PENDING_APPROVAL` | Thiếu validation và registration-token enforcement. |
| PC22 | BLOCKED | PARTIAL | `POST /admin/drivers/{id}/approve|reject` | Approve/reject `200`; missing reason `400`; nonexistent `404`; Customer `403`; `driver.events` offset `0` | RBAC/decision đạt, thiếu event. |
| PC23 | BLOCKED | PARTIAL | `PUT /drivers/me/availability|location` | ONLINE/OFFLINE/location `200`; invalid status `400`; Customer `403`; `driver.events` offset `0` | Command/validation đạt, thiếu event. |
| PC24 | NOT IMPLEMENTED | NOT IMPLEMENTED | `psql` đếm bảng 6 DB; `mongosh` liệt kê DB/collection | 6 PostgreSQL DB đều `tables=0`; Mongo chỉ `admin/config/local`, notification collections `[]`; health báo `persistence.mode=memory,durable=false` | Không có dữ liệu owner ở storage để chứng minh encryption at rest. AES-GCM helper trong code không thay thế persistence evidence. |
| PC25 | BLOCKED | PARTIAL | Login với 3 payload SQLi; kiểm tra DB metadata sau test | Cả 3 trả `401`, không stack/SQL error; nhưng không có bảng/SQL adapter thật (`tables=0`) và PC13 search/query đang lỗi route | Không bypass ở runtime memory; chưa chứng minh an toàn trên SQL query thật. |
| PC26 | BLOCKED | FAIL | Name/review/address chứa `<script>`/`<img onerror>` | Name và review được escape; nhưng `GET /offers` trả nguyên `pickup.address:"<img src=x onerror=alert(1)>"` | Stored/reflected XSS payload ở địa chỉ không được encode. |
| PC27 | BLOCKED | PASS | Tampered payload, `alg=none`, HS256 confusion, missing signature, expired RS256 | Tất cả trả `401 {code:"UNAUTHORIZED"}` | JWT verification chống 5 biến thể. |
| PC28 | BLOCKED | PASS | No-token, wrong role, IDOR trên Customer/Booking/Offer/Trip/Driver admin | No-token `401`; wrong role/IDOR `403`; nonexistent `404` | Authorization chính đạt. |
| PC29 | BLOCKED | PASS | Restart Gateway, `node backend/tests-audit/rate-limit-audit.mjs` | 105 request: `10×200`, `95×429`; first `429` tại request 11, `Retry-After:60`; sau 61 giây login `200` | Ngưỡng/hồi phục đạt; không có `X-RateLimit-*` header. |
| PC30 | BLOCKED | FAIL | `runtime-audit.mjs`; `backend/tests-audit/restart-idempotency.ps1` | Cùng process: replay `201` cùng ID, body đổi `422`, callback trùng `200`; sau restart booking-service, ID đổi `21f...` → `bf8...`, `sameId=False` | Idempotency không bền qua restart do memory mode. |

## Bug theo mức độ

### Critical

Không ghi nhận lỗi Critical có bằng chứng khai thác trực tiếp trong phạm vi audit này.

### High

1. **H-01 — Stack chuẩn không khởi động được Gateway.**
   - Tái hiện: `docker compose --env-file .env up -d --build`; `docker compose ... logs gateway`.
   - Kỳ vọng: Gateway healthy/publish `8000`.
   - Thực tế: `ERR_MODULE_NOT_FOUND: Cannot find module '/app/shared/jwt.js'`; Dockerfile Gateway không copy `shared`.
2. **H-02 — Compose không truyền đường dẫn RS256 key.**
   - Tái hiện sau khi chỉ mount `shared`: login demo.
   - Kỳ vọng: `200` và JWT RS256.
   - Thực tế: `500`; Identity log: `RS256 keys are not configured`; mount `/run/secrets` có nhưng không có `JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH`.
3. **H-03 — Không có persistence, idempotency mất sau restart.**
   - Tái hiện: `backend/tests-audit/restart-idempotency.ps1`.
   - Kỳ vọng: replay cùng key trả cùng booking.
   - Thực tế: `sameId=False`; PostgreSQL/Mongo không có bảng/collection nghiệp vụ.
4. **H-04 — Không có Kafka producer/consumer nghiệp vụ.**
   - Tái hiện: chạy workflow PC15–PC23 rồi `kafka-get-offsets.sh`.
   - Kỳ vọng: offsets tăng theo booking/trip/payment/driver events.
   - Thực tế: mọi partition của 4 topic nghiệp vụ và DLQ đều offset `0`; không có Kafka client trong runtime JS.
5. **H-05 — Driver registration bỏ qua field và registration token.**
   - Tái hiện: `POST /drivers/register` body `{}`, chỉ có `Idempotency-Key`.
   - Kỳ vọng: `400/401`.
   - Thực tế: `201 PENDING_APPROVAL`, tạo driver rỗng.

### Medium

1. **M-01 — `/drivers/nearby` bị route `/:id` che.** Happy và negative đều trả `404 driver not found`.
2. **M-02 — Address XSS không được escape.** Payload `<img ... onerror=...>` xuất hiện nguyên văn trong offer/trip response.
3. **M-03 — Account status sau approve không đồng bộ.** Login driver đã approve vẫn trả `accountStatus:"PENDING_APPROVAL"`, dù Driver Service cho phép ONLINE.

### Low

1. **L-01 — Gateway không trả `X-Request-ID`.** Request ID được gửi upstream nhưng không được đặt trên response Gateway/health.
2. **L-02 — Rate-limit chỉ trả `Retry-After`; thiếu `X-RateLimit-Limit/Remaining`.** Chức năng chặn và recovery vẫn đạt.
3. **L-03 — Baseline command không portable trên Node/Windows.** `node --test backend/gateway/tests` coi thư mục là module và exit `1`; chạy trực tiếp hai file `*.test.js` thì `2/2 PASS`.

## Các PC chưa hoàn tất

- **BLOCKED:** 0.
- **NOT IMPLEMENTED:** PC24 — runtime dùng memory, không có durable adapter/schema/data để kiểm tra encryption at rest.
- **PARTIAL:** PC4, PC15–PC20, PC22–PC23, PC25. Nguyên nhân chính là gRPC chưa bật, Kafka không có runtime event, hoặc DB adapter chưa tồn tại.
- **FAIL:** PC3, PC5, PC6, PC13, PC21, PC26, PC30 — đều có output runtime sai kỳ vọng như bảng trên.

## Tổng kết

| PASS | PARTIAL | FAIL | BLOCKED | NOT IMPLEMENTED | Tổng |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 12 | 10 | 7 | 0 | 1 | 30 |

## Khuyến nghị ưu tiên

1. Sửa packaging/config Gateway trước: copy `shared` vào image và truyền `JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH` cho mọi container.
2. Nối PostgreSQL/MongoDB thật và lưu idempotency/outbox bền vững trước khi đánh giá lại PC24/PC30.
3. Thêm Kafka producer/consumer/outbox và test offsets/DLQ cho PC15–PC23.
4. Bắt buộc schema validation + registration token cho `/drivers/register`; đặt route `/drivers/nearby` trước `/drivers/:id`.
5. Chuẩn hóa output encoding cho mọi field do người dùng nhập, đặc biệt nested address; thêm `X-Request-ID` vào mọi Gateway response.

## Phụ lục bằng chứng thô rút gọn

### Docker/build/stack chuẩn

```text
Docker Engine 29.8.0; OSType: linux; Docker Compose v5.5.1
docker compose --env-file .env up -d --build -> exit 0
gateway-1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/shared/jwt.js'
gateway status: Exited (1)
curl /health, /ready, /health/services -> curl exit 7
```

### Baseline

```text
node backend/scripts/check-contracts.js -> contract JSON: PASS (exit 0)
docker compose --env-file .env.example config --quiet -> exit 0
git diff --check -> exit 0
node --check shared/jwt.js, shared/service-runtime.js, gateway/src/app.js -> exit 0
node --test backend/gateway/tests -> exit 1, MODULE_NOT_FOUND (directory invocation on Windows)
node --test <hai file *.test.js> -> tests 2, pass 2, fail 0
node backend/scripts/smoke-test.js trên stack chuẩn -> REQUIRES_DOCKER, exit 2
smoke trên audit override -> dừng tại PC13: expected 200, received 404, exit 1
```

### Kafka

```text
booking.events
cab.dead-letter
driver.events
payment.events
trip.events

driver.events partitions 0..2 -> offset 0
booking.events partitions 0..2 -> offset 0
trip.events partitions 0..2 -> offset 0
payment.events partitions 0..2 -> offset 0
cab.dead-letter partition 0 -> offset 0
```

### Rate limit

```text
BURST|requests=105|statuses={"200":10,"429":95}
first429.request=11; retryAfter="60"
RECOVERY|afterSeconds=61|status=200
```

### Persistence và restart

```text
cab_identity_db tables=0
cab_customer_db tables=0
cab_driver_db tables=0
cab_booking_db tables=0
cab_trip_db tables=0
cab_payment_db tables=0
Mongo databases=[admin,config,local]; cab_notification_db collections=[]

BEFORE_RESTART bookingId=21f68aaf-604e-432f-89ae-a7ca67d4446c
AFTER_RESTART  bookingId=bf8fede0-a98d-4c54-86ae-c2467fa97dce sameId=False
```

### Script audit

- `backend/tests-audit/docker-compose.audit.yml`: override read-only để tiếp tục functional audit sau khi stack chuẩn lỗi packaging/config.
- `backend/tests-audit/runtime-audit.mjs`: happy/negative/security flows, tự che token.
- `backend/tests-audit/rate-limit-audit.mjs`: burst 105 request và recovery.
- `backend/tests-audit/restart-idempotency.ps1`: replay qua restart service.
