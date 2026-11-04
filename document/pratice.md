# Kịch bản chấm nhanh PC1–PC30

Mục tiêu: trình bày từ PC1 đến PC30, mỗi PC khoảng **20 giây**, tối đa **30 giây**. Không gõ lệnh dài trong lúc chấm. Các request Postman và ba token phải chuẩn bị trước.

## Chuẩn bị trước khi chấm

Chạy hệ thống và tắt pgAdmin để chỉ Gateway public:

```powershell
docker compose up -d
docker compose stop pgadmin
```

Trong Postman dùng:

```text
base = http://localhost:8000/api/v1
C = Customer token
D = Driver token
A = Admin token
```

Tài khoản đang dùng với dữ liệu manual seed:

| Role | Email | Password |
| --- | --- | --- |
| Customer | `kh01@gmail.com` | `12345678` |
| Driver | `dr01@gmail.com` | `12345678` |
| Admin | `adm01@gmail.com` | `12345678` |

Chuẩn bị sẵn các biến:

```text
bookingId, offerId, tripId, paymentId
challengeId, otpCode, registrationToken, newDriverId
```

Quy ước:

- `C`, `D`, `A`: Bearer token Customer, Driver, Admin.
- POST tạo dữ liệu phải có `Idempotency-Key` khác nhau.
- Mở sẵn terminal tại thư mục gốc và các request Postman theo thứ tự bên dưới.
- Khi luyện lại, đổi hậu tố `01` thành `02` để không trùng dữ liệu.

---

## PC1 — Cấu trúc source

Làm:

```powershell
cd backend
ls
cd ..
```

Nói: “Source có Gateway, 7 service, shared contract, infra và scripts; mỗi service sở hữu nghiệp vụ riêng.”

Đạt: thấy `gateway`, `services`, `shared`, `infra`, `scripts`.

## PC2 — `.gitignore` và secret

Làm:

```powershell
git check-ignore .env
```

Nói: “`.env`, key, log và node_modules không được commit; repository chỉ có `.env.example`.”

Đạt: lệnh in `.env`.

## PC3 — Gateway

Postman:

```text
GET {{base}}/health
```

Nói: “Gateway là public entry duy nhất, xử lý route, JWT, RBAC, rate limit và request ID.”

Đạt: `200`, `status: healthy`.

## PC4 — IPC giữa các service

Không chạy lệnh dài, nói:

“Client gọi REST qua Gateway. Các service gọi nhau bằng Internal REST có `X-Service-Token`, dùng Kafka cho event, Redis cho rate limit/GEO và không đọc database của nhau.”

Nếu giảng viên hỏi bằng chứng: mở `docker-compose.yml`, chỉ vào network `cab-internal`.

## PC5 — Docker Compose

Làm:

```powershell
docker compose ps -a
```

Đạt: Gateway, 7 service, PostgreSQL, MongoDB, Redis, Kafka đang chạy; init container được phép `Exited (0)`.

## PC6 — Health bằng Postman

Gửi nhanh ba tab đã mở sẵn:

```text
GET {{base}}/health
GET {{base}}/ready
GET {{base}}/health/services
```

Đạt: đều `200`; service health có đủ 7 service `up`.

## PC7 — Kafka

Làm:

Copy sẵn lệnh này, lúc chấm chỉ dán và Enter:

```powershell
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
```

Đạt: hiện đủ `driver.events`, `booking.events`, `trip.events`, `payment.events`, `cab.dead-letter`. Các dòng `WARNING` về dấu chấm trong metric name không phải lỗi và có thể bỏ qua.

## PC8 — Chỉ Gateway public

Làm:

```powershell
docker compose ps
```

Nói: “Chỉ Gateway publish `8000`; service, PostgreSQL, MongoDB, Redis và Kafka chỉ có port nội bộ.”

Đạt: cột `PORTS` chỉ có `8000` public. Nếu pgAdmin đang chạy thì dừng trước khi chấm.

---

## PC9 — Đăng ký Customer

Postman, không token:

```text
POST {{base}}/auth/register
Idempotency-Key: pc9-01
```

```json
{"fullName":"Khach Test","email":"kh99@gmail.com","phone":"0390000099","password":"12345678"}
```

Đạt: `201`, có `customerId`, `userId`.

## PC10 — Đăng nhập

Postman:

```text
POST {{base}}/auth/login
```

```json
{"email":"kh01@gmail.com","password":"12345678"}
```

Đạt: `200`, có `accessToken`, `role: CUSTOMER`, `accountStatus: ACTIVE`.

## PC11 — Customer xem chính mình

Postman, dùng `C`:

```text
GET {{base}}/customers/me
```

Đạt: `200`, đúng email Customer và không có số dư ví.

## PC12 — Xem Driver public

Đầu tiên dùng `A` lấy danh sách Driver:

```text
GET {{base}}/drivers
```

Copy trường `id` của một Driver. Sau đó đổi sang `C`:

```text
GET {{base}}/drivers/{{driverId}}
```

Đạt: `200`, có tên, xe, biển số; không lộ phone, CCCD/GPLX. Bước đổi từ Admin sang Customer chứng minh Customer chỉ xem được public fields.

## PC13 — Driver gần nhất

Postman, dùng `C`:

```text
GET {{base}}/drivers/nearby?lat=10.776&lng=106.701&radius=3000&page=1&limit=50
```

Đạt: `200`, ít nhất 6 Driver `ONLINE` trong bán kính 3 km; Driver 01-06 cách điểm đón dưới 500 m.

## PC14 — Danh sách booking

Postman, dùng `C`:

```text
GET {{base}}/bookings?page=1&limit=5
```

Đạt: `200`, có `items/page/limit/total`, chỉ có booking của Customer hiện tại.

---

## PC15 — Tạo booking và tính cước

Postman, dùng `C`:

```text
POST {{base}}/bookings
Idempotency-Key: pc15-01
```

```json
{"pickup":{"address":"Go Vap","lat":10.776,"lng":106.701},"destination":{"address":"IUH","lat":10.797,"lng":106.721},"vehicleType":"BIKE"}
```

Đạt: `201`, `SEARCHING`, có `distanceM`, `quotedFareVnd`; cước bằng `ceil(distanceM/100) × 900`. Copy `bookingId`.

## PC16 — Driver nhận chuyến

Postman, dùng `D`:

```text
GET  {{base}}/offers
POST {{base}}/offers/{{offerId}}/accept
```

Request accept có `Idempotency-Key: pc16-01`, body `{}`. Trong response offers, lấy trường `id` của item có đúng `bookingId`; không lấy nhầm `bookingId`.

Đạt: `200`, `ASSIGNED`; copy `tripId`.

## PC17 — Chạy chuyến đúng trình tự

Bốn tab Postman đã mở sẵn, dùng `D`:

```text
PATCH /trips/{{tripId}}/status   {"status":"ARRIVED"}
PATCH /trips/{{tripId}}/status   {"status":"IN_PROGRESS"}
PUT   /trips/{{tripId}}/location {"lat":10.78,"lng":106.71}
PATCH /trips/{{tripId}}/status   {"status":"COMPLETED"}
```

Đạt: đều `200`; trip `COMPLETED`, `paymentStatus: UNPAID`, Driver trở lại `ONLINE`.

## PC18 — Hủy booking

Để làm trong 20 giây, chỉ test hủy booking `SEARCHING`:

1. Tạo booking mới giống PC15, key `pc18-create-01`; copy `bookingId` mới.
2. Dùng `C`:

```text
POST {{base}}/bookings/{{bookingId}}/cancel
Idempotency-Key: pc18-cancel-01
```

```json
{"reason":"Khach doi ke hoach"}
```

Đạt: `200`, `status: CANCELED`. Nói thêm: trip chỉ được hủy ở `ASSIGNED/ARRIVED`; `IN_PROGRESS` trả `409`.

## PC19 — Thanh toán online

Ba tab Postman, dùng `C`:

```text
POST {{base}}/payments
Idempotency-Key: pc19-pay-01
```

```json
{"tripId":"{{tripId}}","method":"ONLINE"}
```

Copy `paymentId`, sau đó:

```text
POST {{base}}/payments/{{paymentId}}/sandbox-confirm
Idempotency-Key: pc19-confirm-01
Body: {"scenario":"SUCCESS"}

GET {{base}}/payments/{{paymentId}}
GET {{base}}/trips/{{tripId}}
```

Đạt: Payment `COMPLETED`; Trip có `paymentStatus: PAID`.

## PC20 — Review

Postman, dùng `C`:

```text
POST {{base}}/trips/{{tripId}}/reviews
Idempotency-Key: pc20-01
```

```json
{"stars":5,"comment":"Tai xe than thien"}
```

Đạt: `201`, đúng `tripId`, `stars: 5`.

---

## PC21 — OTP và đăng ký Driver

Ba tab Postman:

```text
POST {{base}}/drivers/otp/request
Body: {"phone":"0399999998"}
```

Copy `challengeId`, `otpCode` ngẫu nhiên từ response. Trong request verify, gửi giá trị `otpCode` dưới tên trường `code`:

```text
POST {{base}}/drivers/otp/verify
Body: {"phone":"0399999998","challengeId":"{{challengeId}}","code":"{{otpCode}}"}
```

Copy `registrationToken`, rồi gửi:

```text
POST {{base}}/drivers/register
Authorization: Bearer {{registrationToken}}
Idempotency-Key: pc21-01
```

```json
{"fullName":"Driver Test","email":"dr98@gmail.com","password":"12345678","vehicleType":"BIKE","plate":"59A-99998"}
```

Backend lấy số điện thoại từ bước xác minh OTP. Có thể gửi thêm `citizenId` và `licenseNumber` nếu đã có; hai trường này không bắt buộc khi đăng ký.

Đạt: `201`, `PENDING_APPROVAL`; copy `newDriverId`.

## PC22 — Admin duyệt Driver

Postman, dùng `A`:

```text
GET  {{base}}/admin/drivers/{{newDriverId}}
POST {{base}}/admin/drivers/{{newDriverId}}/approve
Body: {}
```

Đạt: `200`, `decision: APPROVE`, Driver chuyển `OFFLINE`.

## PC23 — Driver ONLINE/OFFLINE

Đăng nhập Driver vừa duyệt trước khi tới PC23, lưu token mới. Sau đó:

```text
PUT {{base}}/drivers/me/availability
Body: {"status":"ONLINE"}
```

Đạt: `200`, `status: ONLINE`. Nói: “Driver chưa được duyệt gọi route này sẽ bị `403`.”

---

## Chuẩn bị riêng cho PC24-PC30

Làm phần này **trước buổi chấm**, không tính vào 30 giây của từng PC.

### 1. Lưu token bảo mật

```text
C = Customer token còn hạn
D = Driver token còn hạn
A = Admin token còn hạn
BAD_C = copy C rồi thêm ký tự x vào cuối token
```

Không ghi đè `C` bằng `BAD_C`.

### 2. Tạo trip riêng chưa có review cho PC26

Trip của PC20 đã có review nên không dùng lại. Chuẩn bị một trip khác:

1. Customer tạo booking:

```text
POST {{base}}/bookings
Authorization: Bearer {{C}}
Idempotency-Key: prep-xss-booking-01
```

```json
{"pickup":{"address":"Go Vap","lat":10.776,"lng":106.701},"destination":{"address":"IUH","lat":10.797,"lng":106.721},"vehicleType":"BIKE"}
```

Copy `bookingId`.

2. Driver gọi `GET {{base}}/offers`, tìm đúng `bookingId`, copy `offer.id` rồi nhận chuyến:

```text
POST {{base}}/offers/{{offerId}}/accept
Authorization: Bearer {{D}}
Idempotency-Key: prep-xss-accept-01
Body: {}
```

Copy `tripId` thành `xssTripId`.

3. Driver hoàn thành chuyến, không gửi review:

```text
PATCH {{base}}/trips/{{xssTripId}}/status  {"status":"ARRIVED"}
PATCH {{base}}/trips/{{xssTripId}}/status  {"status":"IN_PROGRESS"}
PATCH {{base}}/trips/{{xssTripId}}/status  {"status":"COMPLETED"}
```

4. Xác nhận chưa có review:

```text
GET {{base}}/trips/{{xssTripId}}/review
Authorization: Bearer {{C}}
```

Đạt: `404 review not found`. Lưu `xssTripId`, không review trước PC26. Review chỉ yêu cầu trip `COMPLETED`, không bắt buộc thanh toán.

### 3. Mở sẵn các tab bảo mật

- PC24: mở sẵn ảnh/query bằng chứng `password_hash`, CCCD/GPLX mã hóa.
- PC25: mở sẵn tab login có payload SQL Injection.
- PC26: mở sẵn `POST /trips/{{xssTripId}}/reviews`, chưa bấm Send.
- PC27: mở sẵn `GET /customers/me` với `BAD_C`.
- PC28: mở sẵn `PUT /drivers/me/availability` với token `C`.
- PC29: chuẩn bị ảnh/log `429` và `Retry-After`; không chạy 100 request lúc chấm.
- PC30: giữ nguyên tab tạo payment PC19 với đúng token, body và key `pc19-pay-01` để gửi lại.

Nếu đã test rate limit trước, đợi ít nhất 61 giây rồi mới login lại.

---

## PC24 — Mã hóa dữ liệu nhạy cảm

Không gõ SQL dài, nói:

“Password được hash bằng scrypt; CCCD và GPLX mã hóa AES-GCM, API chỉ trả masked; khóa nằm trong `.secrets` và bị Git ignore.”

Nếu cần bằng chứng: mở ảnh chụp pgAdmin đã chuẩn bị trước, chỉ vào `password_hash`, `citizen_id`, `license_number`; không cần bật pgAdmin hoặc chạy query trong lúc chấm.

## PC25 — SQL Injection

Postman:

```text
POST {{base}}/auth/login
```

```json
{"email":"' OR 1=1 --","password":"anything"}
```

Đạt: `401`, không có token, không lộ SQL.

## PC26 — XSS

Dùng `xssTripId` riêng đã chuẩn bị, không dùng trip PC20:

```text
POST {{base}}/trips/{{xssTripId}}/reviews
Authorization: Bearer {{C}}
Idempotency-Key: pc26-01
```

```json
{"stars":5,"comment":"<script>alert(1)</script>"}
```

Đạt: output có `&lt;script&gt;`, không có thẻ script thực thi.

## PC27 — Sửa JWT

Postman:

```text
GET {{base}}/customers/me
Authorization: Bearer {{customerToken}}x
```

Đạt: `401`. Nói: “Payload hoặc signature bị sửa đều không hợp lệ vì JWT dùng RS256.”

## PC28 — Sai quyền

Postman, cố ý dùng `C`:

```text
PUT {{base}}/drivers/me/availability
Body: {"status":"ONLINE"}
```

Đạt: `403`, không có side effect.

## PC29 — Rate limit

Không chạy hàng trăm request trong lúc chấm, nói:

“Gateway giới hạn login 10 request/phút và booking 5 request/phút; vượt ngưỡng trả `429` kèm `Retry-After`.”

Mở sẵn ảnh/log kết quả rate-limit nếu giảng viên yêu cầu. Không chạy script dài vì PC này chỉ có 30 giây.

## PC30 — Replay payment / Idempotency

Trong phiếu chấm, body `{"user_id":"USR123","amount":50000}` chỉ minh họa request payment. API CAB lấy Customer từ token và số tiền từ trip; gửi nguyên body minh họa vào `POST /payments` trả `400`. Để chứng minh đúng tiêu chí, replay toàn bộ request hợp lệ của PC19, gồm cả token và `Idempotency-Key`.

Gửi lại đúng request tạo payment ở PC19 bằng cùng Customer token:

```text
POST {{base}}/payments
Idempotency-Key: pc19-pay-01
{"tripId":"{{tripId}}","method":"ONLINE"}
```

Đạt: vẫn `201`, cùng `paymentId` và không tạo payment thứ hai. Nếu payment đã confirm, response replay vẫn là kết quả tạo ban đầu (`PENDING`); dùng `GET /payments/{{paymentId}}` để xem trạng thái hiện tại. Cùng key nhưng đổi body trả `422`; cùng trip với key mới trả `409 PAYMENT_EXISTS`. API lấy Customer từ token và số tiền từ trip, không nhận `user_id` hay `amount` do client tự gửi.

---

## Ghi nhớ để không mất thời gian

- Chấm đúng thứ tự PC1 → PC30, không quay lại tiêu chí cũ.
- PC1–PC8: ưu tiên một lệnh hoặc nói miệng.
- PC9–PC30: dùng các tab Postman đã sắp theo số PC.
- Copy ID ngay khi response xuất hiện, không tìm lại trong database.
- `offerId` là trường `id` của offer, không phải `bookingId`.
- PC17 cập nhật location bằng `PUT`, không phải `PATCH`.
- PC19 chỉ thanh toán sau khi trip `COMPLETED`.
- Nếu PC15 báo `ACTIVE_BOOKING_EXISTS`, hủy booking đang `SEARCHING` trước khi bắt đầu chấm.
