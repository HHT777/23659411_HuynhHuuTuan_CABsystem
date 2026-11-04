# Chạy backend và chấm bằng Postman

## Khởi động

Chạy tại thư mục gốc repository, Docker Desktop ở chế độ Linux containers:

```powershell
node backend/scripts/setup-local-secrets.js
docker compose up -d --build
docker compose ps -a
```

Script tạo khóa JWT và khóa mã hóa giấy tờ nếu chưa có, giữ nguyên khóa đã tồn tại. `.secrets/` và `.env` được Git ignore. Không thay khóa mã hóa khi vẫn cần đọc dữ liệu cũ; sao lưu khóa cùng với backup database, giữ riêng khỏi database.

`STORAGE_MODE=database` là cấu hình mặc định của Compose. Sáu service nghiệp vụ lưu trong PostgreSQL; notification-service lưu trong MongoDB. Các bảng được tạo bằng `CREATE TABLE IF NOT EXISTS` khi service khởi động, tương thích volume hiện có. Không cần xóa volume. `STORAGE_MODE=memory` chỉ dùng kiểm thử tạm, mất dữ liệu sau restart.

## Import và chạy Postman

1. Import `postman/CAB-phieucham.postman_collection.json` và `postman/CAB-local.postman_environment.json`.
2. Chọn environment **CAB local**. Điền `paymentCallbackSecret` bằng giá trị `PAYMENT_CALLBACK_SECRET` trong `.env`. Không chia sẻ/export giá trị secret đã điền. Giá trị demo mặc định của Compose là `cab-local-callback-secret`.
3. Dùng Collection Runner, chạy các request theo thứ tự. Collection tự lưu token, ID booking, offer, trip và payment; email mỗi lượt chạy là duy nhất.
4. Đợi ít nhất 60 giây giữa các lượt chạy, vì API login giới hạn 10 request/phút/IP; tạo booking giới hạn 5 request/phút/user. Request cuối collection cố ý nhận `429`.

Chạy cùng collection tự động bằng Newman, script đọc secret trực tiếp từ `.env`:

```powershell
npm --prefix backend ci
node backend/scripts/run-postman.js
node backend/scripts/verify-database.js
```

Tài khoản seed dùng khi `SEED_DEMO_DATA=true` (mặc định demo):

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Khách hàng | customer@cab.local | Customer123! |
| Tài xế | driver@cab.local | Driver123! |
| Admin | admin@cab.local | Admin123! |

Có 5 tài xế với trạng thái online/offline và 5 booking lịch sử của khách hàng demo để kiểm tra phân trang. Đăng ký tài xế theo thứ tự request OTP → copy `otpCode` ngẫu nhiên từ response sandbox → verify OTP → dùng `registrationToken` để gửi hồ sơ → Admin duyệt/từ chối. OTP có 6 chữ số, thời hạn 5 phút và chỉ verify thành công một lần. Tài xế chưa duyệt không được bật online. Ngoài sandbox, API không trả mã OTP mà adapter SMS phải gửi mã cho tài xế.

### Dữ liệu kiểm tra bán kính 3 km

Chạy một lần sau khi dịch vụ khởi động (có thể chạy lại, script sẽ cập nhật đúng các tài xế mẫu đã tạo):

```powershell
node backend/scripts/seed-nearby-drivers.js
```

Tìm quanh `lat=10.7735&lng=106.699` bằng `GET /drivers/nearby` không truyền `radius`. Tài xế dùng mật khẩu `Driver123!`.

| Tài xế | Email | Khoảng cách xấp xỉ | Trạng thái | Kết quả mặc định |
| --- | --- | ---: | --- | --- |
| Nearby 2 km Bike | nearby-2km-bike@cab.local | 2.0 km | ONLINE | Có |
| Nearby 2.9 km Sedan | nearby-29km-sedan@cab.local | 2.9 km | ONLINE | Có |
| Outside 3.1 km Bike | outside-31km-bike@cab.local | 3.1 km | ONLINE | Không |
| Offline 1.5 km Bike | offline-15km-bike@cab.local | 1.5 km | OFFLINE | Không |

Script tạo tài khoản và cập nhật vị trí qua API nên dữ liệu xuất hiện trong các dịch vụ đang chạy; không xóa booking hay tài xế khác. Cần `SANDBOX_MODE=true` để nhận OTP thử nghiệm.

## PostgreSQL nội bộ Docker

PostgreSQL không publish port `5432` ra host, vì vậy không kết nối trực tiếp bằng pgAdmin/`localhost`. Truy cập quản trị qua container:

```powershell
docker compose exec postgres psql -U cab -d cab_identity_db
```

Liệt kê database và bảng:

```powershell
docker compose exec -T postgres psql -U cab -d cab_identity_db -c "\l"
docker compose exec -T postgres psql -U cab -d cab_identity_db -c "\dt"
```

Các database/bảng nghiệp vụ:

| Database | Bảng nghiệp vụ |
| --- | --- |
| cab_identity_db | users, idempotency |
| cab_customer_db | customers |
| cab_driver_db | drivers, idempotency |
| cab_booking_db | bookings, offers, idempotency |
| cab_trip_db | trips, idempotency |
| cab_payment_db | payments, idempotency |

Mỗi bảng chứa `id` và `data JSONB`; review và lịch sử vị trí nằm trong bản ghi trip. `runtime_metadata` ghi nhận dữ liệu seed đã được lưu. Service chỉ truy cập database của mình; giao tiếp nghiệp vụ qua HTTP nội bộ có `X-Service-Token`.

PC24: chọn `cab_identity_db` và chạy:

```sql
SELECT id, data->>'email' AS email, data->>'password' AS password_hash
FROM users;
```

Mật khẩu lưu bằng scrypt với salt ngẫu nhiên riêng, định dạng `scrypt:<salt>:<hash>`; không lưu mật khẩu plaintext hoặc mã hóa có thể giải mã mật khẩu. Chọn `cab_driver_db`:

```sql
SELECT id, data->>'citizenId' AS citizen_id_encrypted,
       data->>'licenseNumber' AS license_encrypted
FROM drivers
WHERE data ? 'citizenId';
```

Giấy tờ mới có định dạng `v2:local-v1:<iv>:<tag>:<ciphertext>`, mã hóa AES-256-GCM với IV ngẫu nhiên và khóa ngoài DB tại `.secrets/field-encryption.key`, được mount read-only. Các API hồ sơ che giấy tờ. Đây là mã hóa các trường nhạy cảm, không phải mã hóa toàn bộ ổ đĩa/database.

`POSTGRES_PASSWORD` chỉ khởi tạo user khi volume PostgreSQL còn trống. Nếu tự đổi mật khẩu trong `.env` sau đó, phải đổi mật khẩu role trong DB tương ứng; sửa `.env` không tự đổi mật khẩu trên volume cũ.

## MongoDB nội bộ Docker

MongoDB không publish port `27017` ra host, vì vậy Compass trên host không kết nối trực tiếp. Dùng `mongosh` bên trong container:

```powershell
docker compose exec mongodb mongosh "mongodb://localhost:27017/cab_notification_db?replicaSet=rs0"
```

Database `cab_notification_db`, collection `notifications` chứa `recipientId`, `type`, `resourceId`, thời điểm tạo/đọc. Có thể lọc:

```json
{ "data.type": "TRIP_CANCELED" }
```

MongoDB local hiện không bật authentication; quyền truy cập được giới hạn bởi Docker network và việc không publish port. Các biến cũ `MONGO_USER`/`MONGO_PASSWORD` trong `.env` không tự tạo tài khoản hoặc bật authentication trong Compose này. Gateway ở `http://localhost:8000`; port nghiệp vụ `3000–3006`, PostgreSQL `5432` và MongoDB `27017` đều không publish ra host.

## Kiểm tra dữ liệu và replay sau restart

Sau khi chạy collection thành công:

```powershell
node backend/scripts/verify-database.js prepare
docker compose restart identity-service customer-service driver-service booking-service trip-service payment-service notification-service
docker compose ps
# Đợi các service healthy, rồi chạy:
node backend/scripts/verify-database.js replay
node backend/scripts/verify-database.js
```

Script gửi đồng thời 12 request booking trùng khóa sau restart, so sánh toàn bộ response đã lưu và xác nhận số lượng booking không tăng. Business data và idempotency của từng service commit trong cùng transaction trước khi trả HTTP thành công. Khoá idempotency gắn với user, route và thao tác.

## Phạm vi bản thực hành

Thanh toán dùng provider sandbox: collection gửi callback HMAC thật vào backend; chưa tích hợp cổng thanh toán thương mại hay SMS thật. Kafka có broker/topic/init để chấm hạ tầng; workflow hiện dùng HTTP nội bộ, chưa có luồng Kafka outbox/consumer. Rate limiter hiện nằm trong tiến trình Gateway, phù hợp Compose một Gateway, reset khi Gateway restart. Repository dùng JSONB và khóa giao dịch theo service để đảm bảo thứ tự trên bộ dữ liệu thực hành; chưa tối ưu cho tải lớn hoặc giao dịch phân tán khi một service hỏng giữa workflow.
