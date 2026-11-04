# Danh mục endpoint backend

Client và Postman gọi tất cả API public qua Gateway:

```text
http://localhost:8000/api/v1
```

Mở `GET http://localhost:8000/api/v1/endpoints` để nhận catalog JSON mới nhất, được nhóm theo service. Mỗi service cũng khai báo catalog tại `src/api/http/endpoints.routes.js`. Các port `3000–3006` chỉ dùng trong mạng Docker và không gọi trực tiếp từ máy host.

Quy ước header:

- Endpoint có role khác `PUBLIC`: `Authorization: Bearer <accessToken>`.
- Endpoint ghi `idempotent: true`: thêm `Idempotency-Key` duy nhất cho thao tác; gửi lại cùng key và body sẽ nhận kết quả cũ.
- Callback thanh toán: `X-Timestamp` và `X-Signature` HMAC.
- `/internal/*`: chỉ service gọi trong mạng Docker bằng `X-Service-Token`; Gateway chủ động trả 404.

## identity-service — port nội bộ 3000

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Đăng ký khách hàng |
| POST | `/auth/login` | Public | Đăng nhập, nhận JWT |

## customer-service — port nội bộ 3001

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| GET | `/customers` | Admin | Lấy toàn bộ khách hàng |
| GET | `/customers/me` | Customer | Xem hồ sơ bản thân |
| GET | `/customers/:id` | Customer sở hữu/Admin | Xem hồ sơ khách hàng |

## driver-service — port nội bộ 3002

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| GET | `/drivers` | Admin | Lấy toàn bộ tài xế |
| GET | `/drivers/me` | Driver | Xem hồ sơ bản thân |
| PATCH | `/drivers/me` | Driver | Cập nhật hồ sơ bản thân |
| GET | `/drivers/:id` | Customer/Driver sở hữu/Admin | Xem hồ sơ tài xế |
| GET | `/drivers/nearby` | Customer/Admin | Tìm tài xế theo tọa độ, bán kính, phân trang |
| POST | `/drivers/otp/request` | Public | Yêu cầu OTP |
| POST | `/drivers/otp/verify` | Public | Verify OTP, nhận registration token |
| POST | `/drivers/register` | Registration token | Nộp hồ sơ tài xế |
| GET | `/drivers/me/application` | Driver | Xem trạng thái hồ sơ |
| PUT | `/drivers/me/availability` | Driver | Online/offline |
| PUT | `/drivers/me/location` | Driver | Cập nhật vị trí |
| GET | `/admin/drivers` | Admin | Danh sách hồ sơ |
| GET | `/admin/drivers/:id` | Admin | Chi tiết hồ sơ |
| POST | `/admin/drivers/:id/approve` | Admin | Duyệt hồ sơ |
| POST | `/admin/drivers/:id/reject` | Admin | Từ chối hồ sơ |

## booking-service — port nội bộ 3003

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| POST | `/fare-estimates` | Customer/Admin | Ước tính cước |
| POST | `/bookings` | Customer | Đặt xe |
| GET | `/bookings` | Customer sở hữu/Admin | Danh sách booking |
| GET | `/bookings/:id` | Customer sở hữu/Admin | Customer xem booking theo ID |
| GET | `/bookings/:customerId` | Admin | Tất cả booking theo customer ID |
| POST | `/bookings/:id/cancel` | Customer sở hữu | Hủy booking SEARCHING hoặc ASSIGNED |
| GET | `/offers` | Driver | Danh sách offer |
| GET | `/offers/:id` | Driver sở hữu | Chi tiết offer |
| POST | `/offers/:id/accept` | Driver sở hữu | Nhận chuyến |
| POST | `/offers/:id/reject` | Driver sở hữu | Từ chối chuyến |

## trip-service — port nội bộ 3004

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| GET | `/trips` | Customer | Tất cả trip của bản thân |
| GET | `/trips/:id` | Người tham gia/Admin | Người tham gia xem trip theo ID |
| GET | `/trips/:customerId` | Admin | Tất cả trip theo customer ID |
| PATCH | `/trips/:id/status` | Driver được gán | ARRIVED → IN_PROGRESS → COMPLETED |
| PUT | `/trips/:id/location` | Driver được gán | Cập nhật vị trí chuyến |
| POST | `/trips/:id/cancel` | Người tham gia | Hủy chuyến kèm lý do |
| POST | `/trips/:id/reviews` | Customer sở hữu | Đánh giá chuyến |
| GET | `/trips/:id/review` | Người tham gia/Admin | Xem đánh giá |

## payment-service — port nội bộ 3005

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| POST | `/payments` | Customer sở hữu trip | Tạo thanh toán online |
| GET | `/payments/:id` | Customer sở hữu/Admin | Xem thanh toán |
| POST | `/payments/callback` | Provider HMAC | Callback thanh toán |
| POST | `/payments/:id/sandbox-confirm` | Customer sở hữu | Xác nhận sandbox |

## notification-service — port nội bộ 3006

| Method | Path | Quyền | Mục đích |
| --- | --- | --- | --- |
| GET | `/notifications` | Customer/Driver sở hữu | Danh sách thông báo |
| PATCH | `/notifications/:id/read` | Customer/Driver sở hữu | Đánh dấu đã đọc |

Mọi service đều có `GET /health`, `GET /ready` và `GET /endpoints`. Gateway cung cấp `GET /health`, `GET /ready`, `GET /health/services` và `GET /endpoints`.

Collection chạy theo đúng thứ tự nghiệp vụ nằm tại `postman/CAB-phieucham.postman_collection.json`. Xem `document/database-and-postman.md` để biết tài khoản demo và cách chạy Newman.
