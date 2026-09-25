# CAB System API documentation

`openapi.yaml` là entry point modular. Bản tương đương một file nằm tại `../openapi.yaml`.

## Chạy và kiểm tra

Từ thư mục gốc dự án:

```powershell
npx @redocly/cli lint openapi.yaml
npx @redocly/cli lint api-document/openapi.yaml
npx @redocly/cli bundle api-document/openapi.yaml -o openapi.yaml --force
```

Swagger UI không cần Docker (mặc định mở tại `http://127.0.0.1:8080`):

```powershell
npx swagger-ui-watcher openapi.yaml --port 8080
```

Tùy chọn Swagger UI bằng Docker, nếu máy đã cài Docker Desktop:

```powershell
docker run --rm -p 8080:8080 -e SWAGGER_JSON=/spec/api-document/openapi.yaml -v "${PWD}:/spec" swaggerapi/swagger-ui
```

Với bản một file, mở `../openapi.yaml` trong <https://editor.swagger.io>.

Swagger UI phải được mở từ bản bundle gốc `openapi.yaml` để nghiệm thu. Các operation được gắn tag actor và một operation dùng chung có thể xuất hiện ở nhiều nhóm mà vẫn giữ duy nhất một URL và `operationId`.

## Thử API theo actor

1. Mở nhóm **01 - Công khai và Tích hợp**, gọi `POST /api/v1/auth/login` bằng tài khoản của actor cần thử.
2. Lấy `accessToken` trong response, chọn **Authorize** trên Swagger UI và nhập `Bearer <accessToken>`.
3. Mở nhóm actor tương ứng và dùng **Try it out**. Tag chỉ dùng điều hướng; server vẫn kiểm tra bearer token, `x-roles`, quyền sở hữu và điều kiện trạng thái.
4. Muốn đổi actor, chọn **Authorize**, logout token cũ nếu cần, rồi đăng nhập bằng tài khoản actor khác.

| Nhóm Swagger UI | Endpoint chính |
| --- | --- |
| 01 - Công khai và Tích hợp | đăng ký Khách hàng/Tài xế, login, refresh, callback payment sandbox |
| 02 - Khách hàng (CUSTOMER) | hồ sơ chung, RideRequest, Trip, cước/payment, notification/SSE, lịch sử, rating, incident |
| 03 - Tài xế (DRIVER) | hồ sơ/phương tiện/change request, availability, offer, location, Trip, cash, notification/SSE, incident |
| 04 - Nhân viên vận hành (OPERATOR) | tra cứu customers/drivers/vehicles/trips/transactions, duyệt Driver, xử lý incident |
| 05 - Ban lãnh đạo (EXECUTIVE) | xem báo cáo hoạt động |
| 06 - Quản trị viên (ADMIN) | chức năng Vận hành, role, fare và xem báo cáo |

## Quy ước

- Path bắt đầu bằng `/api/v1`, dùng danh từ số nhiều và HTTP method theo ngữ nghĩa REST.
- `operationId` dùng camelCase và duy nhất; mỗi operation có `x-srs-ref`, `x-roles` và ít nhất một tag actor.
- Tag actor chỉ phục vụ điều hướng Swagger UI, không thay thế `security`, kiểm tra quyền hoặc điều kiện sở hữu dữ liệu.
- Tên schema/parameter/response dùng PascalCase; tên file path dùng lowercase/kebab-case.
- Schema dùng `$ref` tương đối, không sao chép định nghĩa giữa các file.

## Thêm endpoint

1. Thêm Path Item vào file phù hợp trong `paths/` và gắn `operationId`, `x-srs-ref`, `x-roles`.
2. Thêm schema, parameter hoặc response mới vào đúng thư mục `components/`, mỗi định nghĩa một file.
3. Khai báo `$ref` của path và component mới trong `openapi.yaml`.
4. Chạy hai lệnh lint và bundle ở trên trước khi hoàn tất.
