# API Document — CAB System
> **Bản chuẩn hóa theo SRS.md phiên bản baseline MVP Việt Nam 2026.** Nội dung `API Document` chính thức nằm tại **PHẦN A** ở cuối file này. Phần hướng dẫn cũ được giữ lại trong **PHỤ LỤC B** để tham khảo nguyên tắc, không dùng làm danh sách endpoint chính thức.
>
> Nguồn truy xuất duy nhất: `SRS.md`, các mục 1–10 và chính sách baseline tại mục 3.3. Không sử dụng phần `PHỤ LỤC — PHÂN TÍCH CŨ` của SRS để sinh API nếu có khác biệt.

---

# PHẦN A — API DOCUMENT CHÍNH THỨC
## A.1. Mục tiêu và phạm vi
API phục vụ Backend, Frontend, QA và Swagger/OpenAPI cho CAB System MVP trong thời gian 7 tuần. API phải phản ánh chuỗi:

```text
SRS → Actor → Use Case → FR → Business Rule/Exception → Business Operation → API Contract
```

Không sinh API cho `Product`, `Order`, `Table`, hủy chuyến độc lập, backup/recovery hoặc quản lý provider bằng API vì SRS không mô tả các Use Case tương ứng.

## A.2. Quy ước chung
| Quy ước | Giá trị |
|---|---|
| Base URL | `/api/v1` |
| Định dạng | JSON UTF-8 |
| Authentication | `Authorization: Bearer <accessToken>`; đăng nhập/trợ giúp tài khoản là public |
| Vai trò | `CUSTOMER`, `DRIVER`, `OPERATOR`, `ADMIN` |
| Tiền tệ | VND, giá trị cước làm tròn đến 1.000 VND |
| Vị trí | WGS84: `latitude`, `longitude`; cập nhật cơ sở 10 giây khi tài xế trực tuyến/đang có chuyến |
| Retry nghiệp vụ | Request cập nhật dùng `Idempotency-Key`; retry tối đa 3 lần; không tạo bản ghi mới khi chưa biết kết quả |
| Lỗi | Dùng `ErrorResponse` thống nhất |
| Nguồn chính | `api-document/openapi.yaml` |
| Bundle | `api-document/dist/openapi.bundle.yaml`, không sửa trực tiếp |

## A.3. Bảng Domain → Use Case → Business Operation → API
| Domain | UC | Business Operation | Method | Endpoint | Auth/Role | Nguồn |
|---|---|---|---|---|---|---|
| Authentication | UC-01 | Đăng ký khách hàng | POST | `/auth/registrations/customer` | Public | FR-01, FR-02 |
| Authentication | UC-02 | Tạo tài khoản tài xế | POST | `/auth/registrations/driver` | `OPERATOR`, `ADMIN`; đăng ký tài xế theo chính sách | FR-03, FR-04 |
| Authentication | UC-03 | Đăng nhập | POST | `/auth/sessions` | Public | FR-05 |
| Authentication | UC-03 | Làm mới access token | POST | `/auth/token-refresh` | Refresh token | Baseline 3.3 |
| Account | UC-04 | Cập nhật hồ sơ của mình | PATCH | `/me/profile` | `CUSTOMER`, `DRIVER` | FR-06, BR-01 |
| Driver | UC-05 | Cập nhật hồ sơ tài xế | PATCH | `/drivers/me/profile` | `DRIVER` | FR-07 |
| Driver | UC-05 | Cập nhật phương tiện được gán | PATCH | `/drivers/me/vehicle` | `DRIVER` | FR-08 |
| Driver | UC-05 | Cập nhật trạng thái sẵn sàng | PATCH | `/drivers/me/availability` | `DRIVER` | FR-09, BR-02 |
| Ride Request | UC-06 | Tạo yêu cầu đặt xe | POST | `/ride-requests` | `CUSTOMER` | FR-10, FR-11, BR-01 |
| Ride Request | UC-06 | Xem yêu cầu của mình | GET | `/ride-requests/{requestId}` | `CUSTOMER` owner, `OPERATOR`, `ADMIN` | FR-11 |
| Dispatch | UC-07 | Nhận đề xuất chuyến | GET | `/ride-offers/{offerId}` | `DRIVER` được đề xuất | FR-15 |
| Dispatch | UC-08 | Chấp nhận/từ chối đề xuất | POST | `/ride-offers/{offerId}/responses` | `DRIVER` được đề xuất | FR-16, BR-03 |
| Trip | UC-09 | Cập nhật trạng thái chuyến | PATCH | `/trips/{tripId}/status` | `DRIVER` được gán | FR-20–FR-23, BR-05 |
| Tracking | UC-10 | Gửi vị trí tài xế | PUT | `/drivers/me/location` | `DRIVER` | FR-19, NFR-09 |
| Tracking | UC-12 | Theo dõi chuyến | GET | `/trips/{tripId}` | `CUSTOMER` owner, `DRIVER` assigned, `OPERATOR`, `ADMIN` | FR-24, FR-25 |
| Fare | UC-13 | Tính và xem cước chuyến | POST/GET | `/trips/{tripId}/fare` | Hệ thống/authorized user | FR-26, baseline cước |
| Payment | UC-14 | Tạo thanh toán | POST | `/trips/{tripId}/payments` | `CUSTOMER` owner | FR-27, FR-28 |
| Payment | UC-14 | Xem trạng thái thanh toán | GET | `/payments/{paymentId}` | `CUSTOMER` owner, `OPERATOR`, `ADMIN` | FR-29, FR-30 |
| Payment | UC-14 | Nhận callback provider | POST | `/payments/provider-callbacks` | Provider signature | FR-28, BR-06, BR-07 |
| Notification | UC-15 | Xem hộp thông báo | GET | `/notifications` | Authenticated user | FR-31–FR-35 |
| History | UC-16 | Xem lịch sử chuyến | GET | `/me/trips` | `CUSTOMER` | FR-36, FR-37 |
| Rating | UC-17 | Tạo đánh giá tài xế | POST | `/trips/{tripId}/rating` | `CUSTOMER` owner | FR-38, baseline rating |
| Operations | UC-18 | Tra cứu/quản lý khách hàng | GET/PATCH | `/operations/customers/{customerId}` | `OPERATOR`, `ADMIN` | FR-39 |
| Operations | UC-18 | Tra cứu/quản lý tài xế | GET/PATCH | `/operations/drivers/{driverId}` | `OPERATOR`, `ADMIN` | FR-40 |
| Operations | UC-18 | Tra cứu/quản lý phương tiện | GET/PATCH | `/operations/vehicles/{vehicleId}` | `OPERATOR`, `ADMIN` | FR-41 |
| Operations | UC-18 | Giám sát chuyến đang diễn ra | GET | `/operations/trips/active` | `OPERATOR`, `ADMIN` | FR-42 |
| Incident | UC-19 | Tạo hồ sơ hỗ trợ chuyến lỗi | POST | `/operations/incidents` | `OPERATOR`, `ADMIN` | FR-43 |
| Incident | UC-19 | Xem/cập nhật sự cố | GET/PATCH | `/operations/incidents/{incidentId}` | `OPERATOR`, `ADMIN` | FR-43 |
| Transactions | UC-19 | Tra cứu giao dịch | GET | `/operations/transactions` | `OPERATOR`, `ADMIN` | FR-44 |
| Authorization/Audit | UC-20 | Xem audit log | GET | `/operations/audit-logs` | `ADMIN`; `OPERATOR` nếu được cấp quyền | FR-45, FR-46 |
| Reporting | UC-21 | Xem báo cáo hoạt động | GET | `/operations/reports` | `OPERATOR`, `ADMIN` | FR-47–FR-50 |

### Trạng thái hệ thống không tạo endpoint riêng
- UC-07 matching được hệ thống kích hoạt sau khi tạo yêu cầu; không cho khách hàng tự chọn tài xế.
- UC-13 tính cước do hệ thống kích hoạt sau khi chuyến hoàn thành; client không gửi công thức cước.
- UC-15 phát thông báo là side effect của sự kiện; client chỉ có API đọc hộp thông báo, không có API gửi tùy ý.
- ACT-04 ban lãnh đạo không có API đăng nhập trực tiếp trong MVP.

## A.4. Authentication và Authorization
### A.4.1. Public API
- `POST /api/v1/auth/registrations/customer`
- `POST /api/v1/auth/registrations/driver` khi chính sách cho phép đăng ký tài xế; MVP ưu tiên `OPERATOR/ADMIN` tạo tài khoản.
- `POST /api/v1/auth/sessions`
- `POST /api/v1/auth/token-refresh`

### A.4.2. Quyền theo vai trò
| Role | Quyền chính |
|---|---|
| `CUSTOMER` | Hồ sơ của mình, tạo/xem yêu cầu của mình, theo dõi chuyến của mình, thanh toán, lịch sử, đánh giá |
| `DRIVER` | Hồ sơ/phương tiện được gán, availability, vị trí, đề xuất chuyến, trạng thái chuyến được gán |
| `OPERATOR` | Thao tác vận hành được cấp: tra cứu/quản lý, giám sát, sự cố, giao dịch, báo cáo |
| `ADMIN` | Toàn bộ quyền vận hành và thao tác nhạy cảm |

Nguyên tắc: **deny by default**, kiểm tra ownership và kiểm tra state transition trước khi ghi dữ liệu.

## A.5. API Contract chi tiết theo nhóm
### A.5.1. Authentication
#### `POST /api/v1/auth/registrations/customer`

- **Mục đích:** Tạo tài khoản khách hàng.
- **Nguồn:** UC-01, FR-01, FR-02.
- **Request:** `phone`, `password`, `fullName`, `otp` nếu yêu cầu xác minh.
- **Validation:** `phone` là số điện thoại Việt Nam; mật khẩu không rỗng; OTP hợp lệ khi được yêu cầu; số điện thoại chưa tồn tại.
- **Success:** `201 Created`, trả `UserSession` hoặc yêu cầu xác minh theo trạng thái.
- **Errors:** `400`, `409`.

#### `POST /api/v1/auth/sessions`

- **Mục đích:** Đăng nhập và cấp Bearer access token/refresh token.
- **Nguồn:** UC-03, FR-05, NFR-01.
- **Request:** `phone`, `password`.
- **Success:** `200 OK`, trả `UserSession`.
- **Errors:** `400`, `401`.

#### `POST /api/v1/auth/token-refresh`

- **Mục đích:** Cấp access token mới từ refresh token.
- **Header:** `Authorization: Bearer <refreshToken>` hoặc body `refreshToken` theo implementation.
- **Success:** `200 OK`.
- **Errors:** `401`.

### A.5.2. Ride Request
#### `POST /api/v1/ride-requests`

- **Mục đích:** Khách hàng tạo yêu cầu đặt xe.
- **Nguồn:** UC-06, FR-10, FR-11, BR-01.
- **Authorization:** `CUSTOMER`.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `pickup`, `destination`, `vehicleType`.
- **Validation:** `pickup`, `destination`, `vehicleType` bắt buộc; `vehicleType` thuộc danh mục đang hoạt động; tọa độ dùng WGS84 nếu có.
- **Success:** `201 Created`, trả `RideRequestResponse` với trạng thái `SEARCHING`.
- **Errors:** `400`, `401`, `409`.
- **Side effect:** Hệ thống bắt đầu UC-07 matching và tạo thông báo tiếp nhận.

#### `GET /api/v1/ride-requests/{requestId}`

- **Mục đích:** Xem trạng thái yêu cầu đặt xe.
- **Authorization:** Customer sở hữu, Operator/Admin.
- **Success:** `200 OK`, trả request status, trip reference nếu đã gán.
- **Errors:** `401`, `403`, `404`.

### A.5.3. Dispatch và Ride Offer
#### `GET /api/v1/ride-offers/{offerId}`

- **Mục đích:** Tài xế xem đề xuất chuyến được gửi cho mình.
- **Authorization:** Chỉ `DRIVER` tương ứng.
- **Success:** `200 OK`.
- **Errors:** `401`, `403`, `404`, `410` khi hết hạn.

#### `POST /api/v1/ride-offers/{offerId}/responses`

- **Mục đích:** Tài xế chấp nhận hoặc từ chối đề xuất.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `{ "decision": "ACCEPT" | "REJECT" }`.
- **Validation:** Đề xuất còn hạn 30 giây; tài xế đúng người; đề xuất chưa có phản hồi.
- **Success:** `200 OK`; ACCEPT tạo/gán trip, REJECT chuyển matching tài xế tiếp theo.
- **Errors:** `400`, `401`, `403`, `409`, `410`.

### A.5.4. Driver Profile, Availability và Location
#### `PATCH /api/v1/drivers/me/profile`

- **Mục đích:** Tài xế cập nhật hồ sơ.
- **Authorization:** `DRIVER`.
- **Request:** Các trường hồ sơ được phép cập nhật.
- **Success:** `200 OK`.
- **Errors:** `400`, `401`.

#### `PATCH /api/v1/drivers/me/availability`

- **Request:** `{ "status": "AVAILABLE" | "OFFLINE" }`.
- **Authorization:** `DRIVER`.
- **Success:** `200 OK`.
- **Errors:** `400`, `401`, `409` nếu tài xế không đủ điều kiện `AVAILABLE`.

#### `PUT /api/v1/drivers/me/location`

- **Mục đích:** Ghi nhận vị trí tài xế.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `{ "latitude": number, "longitude": number, "recordedAt": date-time }`.
- **Validation:** latitude `[-90, 90]`, longitude `[-180, 180]`; chỉ nhận khi tài xế trực tuyến/đang có chuyến.
- **Success:** `200 OK` hoặc `204 No Content`.
- **Errors:** `400`, `401`, `409`.

### A.5.5. Trip và Tracking
#### `GET /api/v1/trips/{tripId}`

- **Mục đích:** Khách hàng theo dõi tài xế, ETA và trạng thái chuyến.
- **Authorization:** Customer owner, Driver assigned, Operator/Admin.
- **Success:** `200 OK`, trả `TripResponse`; ETA có thể `null` nếu thiếu dữ liệu.
- **Errors:** `401`, `403`, `404`.

#### `PATCH /api/v1/trips/{tripId}/status`

- **Mục đích:** Tài xế cập nhật trạng thái chuyến.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `{ "status": "ARRIVED" | "PICKED_UP" | "IN_PROGRESS" | "COMPLETED" }`.
- **Validation:** Chỉ tài xế được gán; trạng thái phải đi đúng thứ tự; không cập nhật chuyến đã kết thúc.
- **Success:** `200 OK`, trả trạng thái mới.
- **Errors:** `400`, `401`, `403`, `404`, `409`.
- **Side effect:** phát thông báo theo FR-31–FR-34.

### A.5.6. Fare và Payment
#### `POST /api/v1/trips/{tripId}/fare`

- **Mục đích:** Hệ thống tính cước sau khi chuyến hoàn thành.
- **Authorization:** Internal/system; Operator/Admin có thể truy vấn.
- **Rule:** Cước cơ sở + quãng đường + thời gian + loại dịch vụ; VND; làm tròn 1.000 VND.
- **Success:** `201 Created` hoặc `200 OK`, trả `FareResponse`.
- **Errors:** `404`, `409` nếu chuyến chưa hoàn thành.

#### `GET /api/v1/trips/{tripId}/fare`

- **Mục đích:** Xem cước của chuyến.
- **Authorization:** Customer owner, Operator/Admin.
- **Success:** `200 OK`.
- **Errors:** `401`, `403`, `404`.

#### `POST /api/v1/trips/{tripId}/payments`

- **Mục đích:** Tạo thanh toán tiền mặt hoặc điện tử.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `{ "method": "CASH" | "ELECTRONIC", "provider": string? }`.
- **Validation:** chuyến hoàn thành; cước tồn tại; không gửi dữ liệu thẻ/tài khoản nhạy cảm; mỗi request có idempotency key.
- **Success:** `201 Created`, trả `PaymentResponse` với `PENDING`, `SUCCESS` hoặc `FAILED`.
- **Errors:** `400`, `401`, `409`, `502` khi provider lỗi.

#### `GET /api/v1/payments/{paymentId}`

- **Mục đích:** Xem trạng thái giao dịch.
- **Authorization:** Customer owner, Operator/Admin.
- **Success:** `200 OK`.
- **Errors:** `401`, `403`, `404`.

#### `POST /api/v1/payments/provider-callbacks`

- **Mục đích:** Nhận kết quả từ Payment Provider.
- **Authentication:** chữ ký webhook/provider; không dùng token người dùng.
- **Request:** payload provider tối thiểu gồm `providerTransactionId`, `paymentId`, `status`, `amount`, `signature`.
- **Validation:** xác minh chữ ký; không chuyển `PENDING` thành `SUCCESS` nếu chưa xác minh.
- **Success:** `200 OK`.
- **Errors:** `400`, `401`, `409`.

### A.5.7. Notifications, History và Rating
#### `GET /api/v1/notifications`

- **Mục đích:** Đọc hộp thông báo của người dùng.
- **Query:** `page`, `pageSize`, `unreadOnly`.
- **Authorization:** mọi user đã đăng nhập; chỉ dữ liệu của mình.
- **Success:** `200 OK`, trả `NotificationPage`.

#### `GET /api/v1/me/trips`

- **Mục đích:** Xem lịch sử chuyến và số tiền phải trả.
- **Query:** `from`, `to`, `page`, `pageSize`.
- **Authorization:** `CUSTOMER`.
- **Success:** `200 OK`, trả `TripHistoryPage`.
- **Errors:** `400`, `401`.

#### `POST /api/v1/trips/{tripId}/rating`

- **Mục đích:** Đánh giá tài xế sau chuyến hoàn thành.
- **Headers:** `Authorization`, `Idempotency-Key`.
- **Request:** `{ "score": 1..5, "comment": string? }`.
- **Validation:** Customer là chủ chuyến; chuyến `COMPLETED`; chưa đánh giá; trong 30 ngày.
- **Success:** `201 Created`.
- **Errors:** `400`, `401`, `403`, `404`, `409`.

### A.5.8. Operations, Incident, Audit và Report
#### `GET/PATCH /api/v1/operations/customers/{customerId}`

- **Authorization:** `OPERATOR`, `ADMIN`; kiểm tra quyền chi tiết.
- **Mục đích:** Tra cứu/cập nhật khách hàng theo FR-39.
- **Success:** `200 OK`.
- **Errors:** `401`, `403`, `404`.

#### `GET/PATCH /api/v1/operations/drivers/{driverId}`

- **Authorization:** `OPERATOR`, `ADMIN`; FR-40.

#### `GET/PATCH /api/v1/operations/vehicles/{vehicleId}`

- **Authorization:** `OPERATOR`, `ADMIN`; FR-41.

#### `GET /api/v1/operations/trips/active`

- **Query:** `status`, `driverId`, `page`, `pageSize`.
- **Authorization:** `OPERATOR`, `ADMIN`; FR-42.

#### `POST /api/v1/operations/incidents`

- **Request:** `tripId`, `category`, `description`.
- **Authorization:** `OPERATOR`, `ADMIN`; FR-43.
- **Success:** `201 Created`.

#### `GET/PATCH /api/v1/operations/incidents/{incidentId}`

- **Authorization:** `OPERATOR`, `ADMIN`.
- **Mục đích:** Tra cứu và cập nhật kết quả hỗ trợ chuyến lỗi.

#### `GET /api/v1/operations/transactions`

- **Query:** `paymentId`, `tripId`, `from`, `to`, `status`, `page`, `pageSize`.
- **Authorization:** `OPERATOR`, `ADMIN`; FR-44.

#### `GET /api/v1/operations/audit-logs`

- **Query:** `actorId`, `action`, `resourceType`, `from`, `to`, `page`, `pageSize`.
- **Authorization:** `ADMIN`; `OPERATOR` chỉ khi được cấp quyền.
- **Response:** không trả dữ liệu thanh toán nhạy cảm.

#### `GET /api/v1/operations/reports`

- **Query:** `period=day|week|month`, `from`, `to`, `driverId?`, `page`, `pageSize`.
- **Authorization:** `OPERATOR`, `ADMIN`.
- **Response:** số chuyến, doanh thu đã ghi nhận, tỷ lệ hoàn thành, tỷ lệ hủy, hiệu quả tài xế.
- **Nguồn:** UC-21, FR-47–FR-50.

## A.6. Schema API
### A.6.1. Request schemas
- `CustomerRegistrationRequest`: `phone`, `password`, `fullName`, `otp?`.
- `DriverRegistrationRequest`: `phone`, `password`, `fullName`, hồ sơ tài xế theo quyền.
- `LoginRequest`: `phone`, `password`.
- `ProfileUpdateRequest`: `fullName`, thông tin liên hệ được phép sửa.
- `RideRequestCreateRequest`: `pickup`, `destination`, `vehicleType`.
- `RideOfferResponseRequest`: `decision` (`ACCEPT|REJECT`).
- `DriverLocationRequest`: `latitude`, `longitude`, `recordedAt`.
- `TripStatusUpdateRequest`: `status` (`ARRIVED|PICKED_UP|IN_PROGRESS|COMPLETED`).
- `PaymentCreateRequest`: `method` (`CASH|ELECTRONIC`), `provider?`.
- `ProviderCallbackRequest`: `providerTransactionId`, `paymentId`, `status`, `amount`, `signature`.
- `RatingCreateRequest`: `score`, `comment?`.
- `IncidentCreateRequest`: `tripId`, `category`, `description`.

### A.6.2. Response schemas
- `UserSession`: `userId`, `role`, `accessToken`, `refreshToken`, `expiresAt`.
- `UserProfile`, `DriverProfile`, `VehicleResponse`.
- `RideRequestResponse`, `RideOfferResponse`, `TripResponse`.
- `DriverLocationResponse`, `FareResponse`, `PaymentResponse`.
- `NotificationPage`, `TripHistoryPage`, `RatingResponse`.
- `IncidentResponse`, `AuditLogPage`, `OperationsReport`.
- `ErrorResponse`.

### A.6.3. Enum chính
```text
Role: CUSTOMER | DRIVER | OPERATOR | ADMIN
DriverAvailability: AVAILABLE | OFFLINE
OfferDecision: ACCEPT | REJECT
TripStatus: ARRIVED | PICKED_UP | IN_PROGRESS | COMPLETED
PaymentMethod: CASH | ELECTRONIC
PaymentStatus: PENDING | SUCCESS | FAILED
RideRequestStatus: SEARCHING | ASSIGNED | NO_DRIVER_FOUND
NotificationChannel: IN_APP | PUSH
```

## A.7. Common Components
### Security
```yaml
securitySchemes:
  bearerAuth:
    type: http
    scheme: bearer
    bearerFormat: JWT
```

Webhook Payment Provider phải có cơ chế xác minh chữ ký riêng; không dùng thông tin đăng nhập của khách hàng.

### Headers
- `Authorization: Bearer <accessToken>`.
- `Idempotency-Key: <unique-key>` cho POST/PATCH/PUT có side effect.
- `Content-Type: application/json`.

### ErrorResponse
```json
{
  "code": "TRIP_STATE_INVALID",
  "message": "Trạng thái chuyến không lệ.",
  "details": [{ "field": "status", "reason": "Không thể chuyển từ COMPLETED sang IN_PROGRESS." }],
  "traceId": "string"
}
```

### HTTP status chuẩn
| Status | Sử dụng |
|---|---|
| 200 | Truy vấn/cập nhật thành công có response body |
| 201 | Tạo tài nguyên thành công |
| 204 | Cập nhật thành công không có body |
| 400 | Request/validation không hợp lệ |
| 401 | Thiếu hoặc hết hạn authentication |
| 403 | Không đủ authorization/ownership |
| 404 | Không tìm thấy tài nguyên |
| 409 | Xung đột state, duplicate hoặc idempotency |
| 410 | Ride offer đã hết hạn |
| 422 | Dữ liệu hợp lệ về cú pháp nhưng không hợp lệ nghiệp vụ, nếu backend chọn dùng |
| 502 | Provider thanh toán/thông báo lỗi |
| 500 | Lỗi hệ thống không xác định |

## A.8. Cấu trúc thư mục API Document cần tạo
```text
api-document/
├── openapi.yaml
├── README.md
├── paths/
│   ├── auth.yaml
│   ├── account.yaml
│   ├── drivers.yaml
│   ├── ride-requests.yaml
│   ├── ride-offers.yaml
│   ├── trips.yaml
│   ├── fares.yaml
│   ├── payments.yaml
│   ├── notifications.yaml
│   ├── history.yaml
│   ├── ratings.yaml
│   ├── operations.yaml
│   ├── incidents.yaml
│   ├── transactions.yaml
│   ├── audit-logs.yaml
│   └── reports.yaml
├── components/
│   ├── schemas/
│   ├── parameters/
│   ├── responses/
│   └── securitySchemes.yaml
├── examples/
├── docs/
│   ├── authentication.md
│   ├── authorization.md
│   ├── error-codes.md
│   └── conventions.md
└── dist/
    └── openapi.bundle.yaml
```

Chỉ tạo file path/schema khi có operation sử dụng. Các folder `products`, `orders`, `tables` không được tạo.

## A.9. Quy tắc OpenAPI, `$ref`, Bundle và Swagger
- `openapi.yaml` là Source of Truth.
- OpenAPI version sử dụng `3.0.3` hoặc `3.1.0`, thống nhất một phiên bản trong toàn bộ tài liệu.
- Path file dùng `$ref` đến đúng component; không copy schema lặp lại.
- Mọi `$ref` phải resolve được và không circular reference ngoài ý muốn.
- `dist/openapi.bundle.yaml` phải độc lập, không còn `$ref` file nội bộ chưa resolve.
- Không sửa trực tiếp file trong `dist/`.
- Sau mỗi thay đổi: validate → bundle → kiểm tra Swagger.
- Tất cả nội dung Markdown trong `api-document/` viết bằng tiếng Việt.

## A.10. Validation checklist
### Requirement traceability
- [x] 21 Use Case của SRS đã được xem xét.
- [x] FR-01 đến FR-50 có operation hoặc được phản ánh là side effect/internal operation.
- [x] Mỗi operation có UC/FR nguồn.
- [x] Không có domain ngoài SRS.

### API contract
- [ ] Mỗi operation có request, response, validation, lỗi và status code trong YAML.
- [ ] Ownership được kiểm tra cho customer/driver resources.
- [ ] Role `OPERATOR`/`ADMIN` được kiểm tra trước API vận hành.
- [ ] State transition chuyến được kiểm tra.
- [ ] Idempotency được áp dụng cho side-effect API.
- [ ] Provider callback xác minh chữ ký.

### Schema và bảo mật
- [ ] Không expose password hash, token thanh toán hoặc dữ liệu thẻ/tài khoản.
- [ ] `PaymentStatus` có `PENDING`.
- [ ] Tọa độ và timestamp có validation.
- [ ] Rating giới hạn 1–5 và thời hạn 30 ngày.
- [ ] Error response thống nhất.

### OpenAPI/Bundle
- [ ] OpenAPI hợp lệ.
- [ ] Tất cả `$ref` resolve được.
- [ ] Bundle độc lập.
- [ ] Swagger hiển thị đủ path, security, request/response schema.

## A.11. Cần làm rõ còn lại
### CL-01 — Biểu phí chính thức
- **Thông tin thiếu:** Công thức/biểu phí của Công ty ABC nếu khác baseline.
- **API/Use Case:** `POST/GET /trips/{tripId}/fare`, UC-13, FR-26.
- **Cần bổ sung:** Phí mở cửa, đơn giá km/phút, phụ phí và thời điểm áp dụng.

### CL-02 — Danh mục dịch vụ
- **Thông tin thiếu:** Loại xe, loại dịch vụ và khu vực phục vụ thực tế.
- **API/Use Case:** Ride Request, Driver, UC-05, UC-06.
- **Cần bổ sung:** Danh mục, mã, trạng thái hoạt động và điều kiện tương thích phương tiện.

### CL-03 — Thanh toán và đối soát
- **Thông tin thiếu:** Tên provider, contract, webhook và yêu cầu đối soát.
- **API/Use Case:** Payment, UC-14, FR-28–FR-30.
- **Cần bổ sung:** Signature, trạng thái provider, quy trình đối soát và xử lý lệch giao dịch.

### CL-04 — Thông báo thương hiệu
- **Thông tin thiếu:** Tài khoản provider, template và yêu cầu thương hiệu.
- **API/Use Case:** Notification, UC-09, UC-15.
- **Cần bổ sung:** Cấu hình provider và template chính thức.

### CL-05 — Quyền mở rộng
- **Thông tin thiếu:** Permission khác baseline bốn role.
- **API/Use Case:** Operations, Incident, Audit, Reporting.
- **Cần bổ sung:** Ma trận quyền chi tiết nếu khác `CUSTOMER`, `DRIVER`, `OPERATOR`, `ADMIN`.

### CL-06 — SLA/tải cao hơn MVP
- **Thông tin thiếu:** P95, tải đồng thời hoặc tiêu chí bàn giao cao hơn baseline.
- **API/Use Case:** Toàn hệ thống.
- **Cần bổ sung:** Chỉ tiêu hiệu năng, tải và ưu tiên triển khai.

### CL-07 — Lưu trữ pháp lý/audit
- **Thông tin thiếu:** Yêu cầu riêng của doanh nghiệp/pháp lý.
- **API/Use Case:** History, Payment, Audit.
- **Cần bổ sung:** Thời hạn, phạm vi và quyền truy cập dữ liệu lưu trữ.

---

# PHỤ LỤC B — NGUYÊN TẮC THAM KHẢO TỪ PHIÊN BẢN CŨ
Các nguyên tắc RESTful, domain-oriented, OpenAPI 3.x, `$ref`, bundle, Swagger, validation và yêu cầu ngôn ngữ trong phần còn lại của file cũ vẫn có giá trị tham khảo nếu không mâu thuẫn với PHẦN A. Khi có mâu thuẫn, PHẦN A và SRS baseline MVP được ưu tiên.


---

# 1. Mục tiêu

Chuyển đổi các yêu cầu trong SRS thành **API Contract (hợp đồng API)** rõ ràng, nhất quán và có thể sử dụng trực tiếp cho:

- Backend triển khai API.
- Frontend tích hợp API.
- QA/Test xây dựng test case và kiểm thử API.
- Swagger/OpenAPI hiển thị và kiểm thử API.
- Làm tài liệu thống nhất giữa các thành viên trong nhóm.

Nếu SRS chưa cung cấp đủ thông tin để thiết kế một API chính xác, **không được tự suy đoán**.

Thay vào đó, đánh dấu:

```text
[NEED CLARIFICATION]
```

và giải thích rõ thông tin còn thiếu.

---

# 2. Quy trình thiết kế bắt buộc

Thực hiện quá trình thiết kế theo đúng thứ tự:

```text
SRS
↓
Xác định miền nghiệp vụ
↓
Xác định Use Case
↓
Xác định chức năng/nghiệp vụ cần thực hiện
↓
Thiết kế API Endpoint
↓
Thiết kế API Contract
↓
Thiết kế Schema
↓
Viết OpenAPI YAML
↓
Kiểm tra và xác thực
↓
Bundle
↓
Swagger
```

Không được bỏ qua bước phân tích yêu cầu trước khi thiết kế API.

---

# 3. Xác định miền nghiệp vụ

Đọc toàn bộ SRS và nhóm các Use Case theo **miền nghiệp vụ (Business Domain)**.

Ví dụ:

```text
Authentication
User Management
Employee Management
Product Management
Order Management
Table Management
Payment
```

Việc xác định miền nghiệp vụ phải dựa trên:

- Yêu cầu nghiệp vụ.
- Use Case.
- Business Rule.
- Quy trình nghiệp vụ.
- Phạm vi hệ thống.

**Không được xác định miền nghiệp vụ chỉ dựa trên tên bảng database.**

Ví dụ không được suy luận:

```text
Database có bảng Product
→ chắc chắn phải tạo Product CRUD API
```

Mà phải xác định:

```text
SRS
→ Use Case
→ Nghiệp vụ liên quan đến Product
→ API cần thiết
```

---

# 4. Mapping Use Case → API

Với mỗi Use Case, xác định các **Business Operation (thao tác nghiệp vụ)** cần API.

Ví dụ:

```text
Use Case: Quản lý sản phẩm

Xem danh sách
GET /api/v1/products

Xem chi tiết
GET /api/v1/products/{id}

Tạo sản phẩm
POST /api/v1/products

Cập nhật sản phẩm
PUT /api/v1/products/{id}

Xóa sản phẩm
DELETE /api/v1/products/{id}
```

Chỉ tạo API khi có cơ sở từ:

- SRS.
- Use Case.
- Business Rule.
- Quy trình nghiệp vụ được mô tả trong SRS.

Không tự tạo API chỉ vì database có bảng tương ứng.

---

# 5. Thiết kế API Contract

Với mỗi API Endpoint, xác định đầy đủ các thông tin:

- Tên API.
- Mục đích sử dụng.
- HTTP Method.
- Endpoint.
- Authentication (xác thực).
- Authorization (phân quyền).
- Path Parameters.
- Query Parameters.
- Request Headers.
- Request Body.
- Quy tắc Validation (kiểm tra dữ liệu).
- Success Response (kết quả thành công).
- HTTP Status Code.
- Error Response (kết quả lỗi).
- Business Rules liên quan.

Mỗi API phải có khả năng **truy ngược về Use Case hoặc Requirement tương ứng trong SRS**.

Nếu không xác định được nguồn yêu cầu của API, đánh dấu:

```text
[NEED CLARIFICATION]
```

---

# 6. Thiết kế Data Schema

Xác định các **Schema (cấu trúc dữ liệu)** cần thiết cho API.

Phân loại:

```text
Request Model
Response Model
Entity Model
```

Ví dụ:

```text
schemas/
└── product/
    ├── Product.yaml
    ├── ProductRequest.yaml
    └── ProductResponse.yaml
```

Schema phải mô tả rõ:

- Tên thuộc tính.
- Kiểu dữ liệu.
- Thuộc tính bắt buộc.
- Giá trị mặc định nếu có.
- Giới hạn dữ liệu nếu có.
- Mô tả nghiệp vụ nếu cần.
- Ví dụ dữ liệu.

Không expose trực tiếp cấu trúc database nếu điều đó không cần thiết cho API Contract.

---

# 7. Thiết kế các thành phần dùng chung

Xác định các thành phần có khả năng được sử dụng bởi nhiều API.

```text
parameters/
responses/
security/
```

Có thể bao gồm:

```text
ID Parameters
Pagination
Sorting
Filtering

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error

JWT / Bearer Authentication
```

Chỉ tạo thành phần dùng chung khi thực sự có nhu cầu sử dụng.

Không tạo hàng loạt file hoặc component không được sử dụng.

---

# 8. Cấu trúc API Document

Tổ chức API Document theo cấu trúc sau:

```text
api-document/
│
├── openapi.yaml                    # File OpenAPI chính
├── README.md                       # Hướng dẫn tổng quan
│
├── paths/                          # Các API Endpoint
│   ├── auth/
│   │   └── auth.yaml
│   ├── users/
│   │   └── users.yaml
│   ├── employees/
│   │   └── employees.yaml
│   ├── products/
│   │   └── products.yaml
│   ├── orders/
│   │   └── orders.yaml
│   ├── tables/
│   │   └── tables.yaml
│   └── payments/
│       └── payments.yaml
│
├── schemas/                        # Các cấu trúc dữ liệu
│   ├── auth/
│   ├── user/
│   ├── employee/
│   ├── product/
│   ├── order/
│   ├── table/
│   └── payment/
│
├── parameters/                     # Tham số dùng chung
│
├── responses/                      # Response dùng chung
│
├── security/                       # Xác thực và phân quyền
│
├── examples/                       # Dữ liệu Request/Response mẫu
│
├── docs/                           # Quy ước và hướng dẫn API
│   ├── authentication.md
│   ├── authorization.md
│   ├── error-codes.md
│   └── conventions.md
│
└── dist/                           # File API đã được đóng gói
    └── openapi.bundle.yaml
```

Không bắt buộc phải tạo domain hoặc folder nếu SRS không có nghiệp vụ tương ứng.

Không tạo file/folder chỉ để làm đẹp cấu trúc.

---

# 9. Quy tắc đối với thư mục `dist/`

Thư mục:

```text
dist/
```

dùng để chứa **API Specification đã được Bundle (đóng gói)** từ toàn bộ các file YAML và `$ref`.

Cấu trúc:

```text
api-document/
│
├── openapi.yaml
├── paths/
├── schemas/
├── parameters/
├── responses/
├── security/
│
└── dist/
    └── openapi.bundle.yaml
```

`openapi.yaml` là **file nguồn chính (Source of Truth)** của API Document.

`dist/openapi.bundle.yaml` là **file đã gộp toàn bộ các `$ref`**, để có thể sử dụng độc lập cho:

- Swagger Editor.
- Swagger UI.
- Kiểm thử API.
- Chia sẻ cho Frontend.
- Chia sẻ cho Backend.
- Chia sẻ cho QA.
- Kiểm tra tính hợp lệ của OpenAPI.
- Phát hành phiên bản API Document.

Không được chỉnh sửa trực tiếp:

```text
dist/openapi.bundle.yaml
```

Nếu API thay đổi:

```text
Sửa file nguồn
↓
Kiểm tra
↓
Bundle lại
↓
Cập nhật dist/openapi.bundle.yaml
```

---

# 10. Quy tắc sử dụng `$ref`

Ưu tiên sử dụng `$ref` để tái sử dụng các thành phần.

Ví dụ:

```yaml
$ref: "./schemas/product/Product.yaml"
```

Không sao chép cùng một Schema, Parameter hoặc Response vào nhiều file.

Mọi `$ref` phải được kiểm tra:

- File được tham chiếu có tồn tại.
- Đường dẫn chính xác.
- Component được tham chiếu đúng loại.
- Không có circular reference (tham chiếu vòng) ngoài ý muốn.
- Có thể resolve (giải quyết tham chiếu) thành công.
- Có thể Bundle thành công.

---

# 11. Quy tắc thiết kế API

Áp dụng thống nhất các quy tắc sau:

1. Sử dụng RESTful API.

2. Endpoint ưu tiên sử dụng danh từ thay vì động từ.

3. Sử dụng HTTP Method đúng mục đích:

```text
GET    → Lấy dữ liệu
POST   → Tạo dữ liệu
PUT    → Cập nhật toàn bộ
PATCH  → Cập nhật một phần
DELETE → Xóa dữ liệu
```

4. Sử dụng URL versioning:

```text
/api/v1/...
```

5. Sử dụng Path Parameter cho resource identifier.

6. Sử dụng Query Parameter cho:

```text
filter
search
sort
pagination
```

7. Request và Response sử dụng JSON nếu không có yêu cầu khác trong SRS.

8. Chuẩn hóa HTTP Status Code.

9. Chuẩn hóa Error Response.

10. Tái sử dụng Schema, Parameter và Response bằng `$ref`.

11. Authentication và Authorization phải được mô tả rõ.

12. API phải phản ánh đúng Business Rule trong SRS.

13. Không expose trực tiếp database structure nếu không cần thiết.

14. Không thiết kế API chỉ dựa trên CRUD database.

API phải phục vụ **Business Operation (nghiệp vụ)**.

15. Naming Convention phải nhất quán.

16. Không tạo Endpoint trùng chức năng.

17. Không tạo API ngoài phạm vi SRS nếu không có lý do và không được đánh dấu `[NEED CLARIFICATION]`.

---

# 12. Format kết quả phân tích

Trước khi viết bất kỳ YAML nào, tạo bảng:

| Domain | Use Case | Operation | Method | Endpoint | Auth |
| ------ | -------- | --------- | ------ | -------- | ---- |

Sau đó thực hiện theo thứ tự:

## 12.1. Tổng quan thiết kế API

Liệt kê toàn bộ API được xác định từ SRS.

## 12.2. Mapping Requirement → API

Cho biết mỗi API xuất phát từ:

```text
Requirement
↓
Use Case
↓
Business Rule
↓
Business Operation
```

Nếu không xác định được nguồn:

```text
[NEED CLARIFICATION]
```

## 12.3. API Contract

Mô tả chi tiết từng API:

- Endpoint.
- Method.
- Authentication.
- Authorization.
- Parameters.
- Request.
- Response.
- Error.
- Validation.
- Business Rules.

## 12.4. Schema Design

Liệt kê:

```text
Request Schema
Response Schema
Entity Schema
```

## 12.5. Common Components

Liệt kê:

```text
Parameters
Responses
Security
```

## 12.6. API Document Structure

Đề xuất chính xác các file cần tạo trong:

```text
api-document/
```

Không tạo file/folder không cần thiết.

## 12.7. OpenAPI YAML

Sinh:

```text
openapi.yaml
```

và toàn bộ các file YAML được tham chiếu bằng `$ref`.

## 12.8. Bundle Specification

Sinh:

```text
dist/openapi.bundle.yaml
```

File Bundle phải chứa đầy đủ nội dung cần thiết để Swagger có thể đọc **độc lập**, không cần truy cập các file YAML nguồn.

## 12.9. Validation

Kiểm tra toàn bộ API Document.

### Kiểm tra yêu cầu

- API có tồn tại trong SRS không?
- API có mapping với Use Case không?
- Có API bị thừa không?
- Có Business Rule nào chưa được phản ánh không?

### Kiểm tra API

- Endpoint có nhất quán không?
- HTTP Method có phù hợp không?
- Request/Response có đầy đủ không?
- Status Code có hợp lý không?
- Authentication/Authorization có đầy đủ không?

### Kiểm tra Schema

- Schema có bị lặp không?
- Request/Response có đúng cấu trúc không?
- Required Fields có chính xác không?
- Data Type có phù hợp không?
- Validation có phù hợp với SRS không?

### Kiểm tra `$ref`

- Tất cả `$ref` có tồn tại không?
- Đường dẫn `$ref` có chính xác không?
- Có circular reference không?
- Có resolve được toàn bộ `$ref` không?

### Kiểm tra OpenAPI

- `openapi.yaml` có hợp lệ theo OpenAPI 3.x không?
- `openapi.bundle.yaml` có hợp lệ không?
- Bundle có thể import vào Swagger Editor không?
- Swagger có hiển thị đầy đủ Endpoint không?
- Swagger có hiển thị đúng Request/Response Schema không?

---

# 13. Cần làm rõ

Cuối cùng luôn tạo mục:

```text
[Cần làm rõ]
```

Liệt kê tất cả thông tin trong SRS chưa đủ để thiết kế API chính xác.

Mỗi vấn đề phải nêu:

```text
Vấn đề:
Thông tin đang thiếu:
API/Use Case bị ảnh hưởng:
Thông tin cần bổ sung:
```

Không được tự suy đoán nghiệp vụ để lấp khoảng trống.

---

# 14. Nguyên tắc thiết kế quan trọng nhất

Không thiết kế API theo cách:

```text
Database Table
↓
CRUD API
```

Mà phải thiết kế theo:

```text
Business Requirement
↓
Use Case
↓
Business Rule
↓
Business Operation
↓
API Contract
↓
Schema
↓
OpenAPI
```

Mục tiêu là API phản ánh **nghiệp vụ của hệ thống**, không chỉ phản ánh cấu trúc database.

---

# 15. Nguyên tắc quản lý nguồn API

Quy ước cuối cùng:

```text
api-document/
│
├── openapi.yaml
│
├── paths/
├── schemas/
├── parameters/
├── responses/
├── security/
├── examples/
├── docs/
│
└── dist/
    └── openapi.bundle.yaml
```

Trong đó:

```text
openapi.yaml
    ↓
Nguồn API chính
    ↓
Các file $ref
    ↓
Bundle
    ↓
dist/openapi.bundle.yaml
    ↓
Swagger / Testing / Sharing
```

**Không chỉnh sửa trực tiếp file trong `dist/`.**

Mọi thay đổi phải bắt đầu từ các file nguồn và sau đó Bundle lại.

API Document phải là **single source of truth (nguồn sự thật duy nhất)** cho API Contract giữa Backend, Frontend và QA.

### Yêu cầu về ngôn ngữ tài liệu

- **Tất cả các file có phần mở rộng `.md` phải được viết bằng tiếng Việt.**
- Nội dung Markdown phải rõ ràng, dễ đọc và phù hợp với tài liệu kỹ thuật của dự án.
- Các thuật ngữ kỹ thuật phổ biến có thể giữ nguyên tiếng Anh và ghi chú nghĩa tiếng Việt khi cần, ví dụ:
  - API (Giao diện lập trình ứng dụng)
  - Endpoint (điểm truy cập API)
  - Request (yêu cầu)
  - Response (phản hồi)
  - Schema (cấu trúc dữ liệu)
  - Authentication (xác thực)
  - Authorization (phân quyền)
  - Business Rule (quy tắc nghiệp vụ)
  - Validation (kiểm tra tính hợp lệ)

- Không viết nội dung `.md` hoàn toàn bằng tiếng Anh.
- Tên file, tên thư mục, tên API, endpoint, HTTP method, field JSON, schema và các thành phần OpenAPI có thể sử dụng tiếng Anh theo chuẩn kỹ thuật.
- Nội dung mô tả, giải thích, hướng dẫn sử dụng, quy tắc nghiệp vụ và tài liệu thiết kế trong `.md` phải ưu tiên tiếng Việt.

### Các file `.md` cần áp dụng

Ví dụ:

```text
api-document/
├── README.md                 # Tiếng Việt
├── docs/
│   ├── authentication.md     # Tiếng Việt
│   ├── authorization.md      # Tiếng Việt
│   ├── error-codes.md        # Tiếng Việt
│   └── conventions.md        # Tiếng Việt
└── ...
```

Đối với các file YAML:

- Có thể sử dụng tiếng Anh cho cấu trúc OpenAPI, tên field, schema, endpoint và HTTP method.
- Các trường mô tả như `summary`, `description`, `title`, `example` nên viết bằng **tiếng Việt** nếu không ảnh hưởng đến chuẩn OpenAPI.
- Ví dụ:

```yaml
summary: Lấy danh sách sản phẩm
description: Lấy danh sách sản phẩm đang được quản lý trong hệ thống.
```

### Nguyên tắc ngôn ngữ

**Nội dung nghiệp vụ và tài liệu → Tiếng Việt.**

**Cấu trúc kỹ thuật và định danh API → Tiếng Anh theo chuẩn.**

Không tự ý chuyển toàn bộ tài liệu sang tiếng Anh chỉ vì OpenAPI sử dụng các thuật ngữ kỹ thuật bằng tiếng Anh.
