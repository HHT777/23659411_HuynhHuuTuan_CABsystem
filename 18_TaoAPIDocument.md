Tôi đã hoàn thành tài liệu **SRS (Software Requirements Specification – Đặc tả yêu cầu phần mềm)** cho hệ thống.

Hãy dựa **hoàn toàn trên nội dung SRS được cung cấp** để thiết kế **API Document (tài liệu đặc tả API)** theo hướng **domain-oriented (phân chia theo miền nghiệp vụ)** và chuẩn **OpenAPI 3.x**.

Không được tự ý thêm, bỏ hoặc thay đổi nghiệp vụ đã được mô tả trong SRS.

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
