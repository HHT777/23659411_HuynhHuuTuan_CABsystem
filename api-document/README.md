# CAB System API documentation

`openapi.yaml` là entry point modular. Bản tương đương một file nằm tại `../openapi.yaml`.

## Chạy và kiểm tra

Từ thư mục gốc dự án:

```powershell
npx @redocly/cli lint openapi.yaml
npx @redocly/cli lint api-document/openapi.yaml
npx @redocly/cli bundle api-document/openapi.yaml -o /tmp/bundled.yaml
```

Swagger UI không cần Docker (mặc định mở tại `http://127.0.0.1:8080`):

```powershell
npx swagger-ui-watcher api-document/openapi.yaml --port 8080
```

Tùy chọn Swagger UI bằng Docker, nếu máy đã cài Docker Desktop:

```powershell
docker run --rm -p 8080:8080 -e SWAGGER_JSON=/spec/api-document/openapi.yaml -v "${PWD}:/spec" swaggerapi/swagger-ui
```

Với bản một file, mở `../openapi.yaml` trong <https://editor.swagger.io>.

## Quy ước

- Path bắt đầu bằng `/api/v1`, dùng danh từ số nhiều và HTTP method theo ngữ nghĩa REST.
- `operationId` dùng camelCase và duy nhất; mỗi operation có `x-srs-ref` và `x-roles`.
- Tên schema/parameter/response dùng PascalCase; tên file path dùng lowercase/kebab-case.
- Schema dùng `$ref` tương đối, không sao chép định nghĩa giữa các file.

## Thêm endpoint

1. Thêm Path Item vào file phù hợp trong `paths/` và gắn `operationId`, `x-srs-ref`, `x-roles`.
2. Thêm schema, parameter hoặc response mới vào đúng thư mục `components/`, mỗi định nghĩa một file.
3. Khai báo `$ref` của path và component mới trong `openapi.yaml`.
4. Chạy hai lệnh lint và bundle ở trên trước khi hoàn tất.
