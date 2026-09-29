# CAB System OpenAPI 3.0.3

Bộ đặc tả này được sinh từ `SRS.md`; mục 12.1 là nguồn duy nhất cho danh sách 30 API, method, path, UC, role, request/response, status, idempotency và rate limit. Các ràng buộc schema và ví dụ đối chiếu DEC-01–38, FR-01–56, BRULE/EX/NFR, Domain Model, Use Case và Boundary Conditions.

## Cấu trúc

```text
api_document/
├── openapi.yaml
├── _manifest.yaml
├── ASSUMPTIONS.md
├── redocly.yaml
├── _common/
│   ├── schemas.yaml
│   ├── errors.yaml
│   └── parameters.yaml
├── customer/              # 5 fragment
├── driver/                # 6 fragment
├── operator/              # 6 fragment
├── shared/                # 8 fragment
├── system/                # 1 fragment
└── scripts/
    ├── build_openapi.py
    ├── validate_openapi.py
    └── compare_equivalence.py
```

## Ánh xạ API → UC → fragment

| API | UC | File |
| --- | --- | --- |
| API-01 | UC-01.1 | `customer/uc-01.1-dang-ky-khach-hang.yaml` |
| API-02 | UC-01.2 | `driver/uc-01.2-dang-ky-tai-xe.yaml` |
| API-03 | UC-02 | `shared/uc-02-dang-nhap.yaml` |
| API-04 | UC-02 | `shared/uc-02-dang-nhap.yaml` |
| API-05 | UC-03.1 | `shared/uc-03.1-cap-nhat-ho-so.yaml` |
| API-06 | UC-04 | `driver/uc-04-cap-nhat-availability.yaml` |
| API-07 | UC-08 | `driver/uc-08-cap-nhat-vi-tri.yaml` |
| API-08 | UC-16.6 | `operator/uc-16.6-tao-tai-khoan-noi-bo.yaml` |
| API-09 | UC-16.5 | `operator/uc-16.5-khoa-mo-tai-khoan.yaml` |
| API-10 | UC-16.5 | `operator/uc-16.5-khoa-mo-tai-khoan.yaml` |
| API-11 | UC-05.1 | `customer/uc-05.1-tao-yeu-cau-dat-xe.yaml` |
| API-12 | UC-05.2 | `customer/uc-05.2-huy-yeu-cau.yaml` |
| API-13 | UC-07.1/07.2 | `driver/uc-07-phan-hoi-loi-moi.yaml` |
| API-14 | UC-09.1 | `driver/uc-09.1-cap-nhat-moc-chuyen.yaml` |
| API-15 | UC-09.2 | `shared/uc-09.2-huy-chuyen.yaml` |
| API-16 | UC-10 | `shared/uc-10-theo-doi-chuyen.yaml` |
| API-17 | UC-15 | `customer/uc-15-danh-gia-tai-xe.yaml` |
| API-18 | UC-05.1 | `customer/uc-05.1-tao-yeu-cau-dat-xe.yaml` |
| API-19 | UC-11 | `shared/uc-11-xem-cuoc.yaml` |
| API-20 | UC-11.2 | `operator/uc-11.2-fare-review.yaml` |
| API-21 | UC-12.2 | `customer/uc-12.2-khoi-tao-thanh-toan.yaml` |
| API-22 | UC-12.1 | `driver/uc-12.1-xac-nhan-tien-mat.yaml` |
| API-23 | UC-12.3 | `system/uc-12.3-callback-thanh-toan.yaml` |
| API-24 | UC-13.3 | `shared/uc-13.3-hop-thong-bao.yaml` |
| API-25 | UC-13.3 | `shared/uc-13.3-hop-thong-bao.yaml` |
| API-26 | UC-13.2 | `shared/uc-13.2-sse-events.yaml` |
| API-27 | UC-16.7 | `operator/uc-16.7-xem-chuyen-dang-chay.yaml` |
| API-28 | UC-17.1 | `shared/uc-17.1-bao-su-co.yaml` |
| API-29 | UC-17.2 | `operator/uc-17.2-xu-ly-su-co.yaml` |
| API-30 | UC-18.1/18.2 | `operator/uc-18-bao-cao.yaml` |

## Kiểm tra và xem tài liệu

```bash
python api_document/scripts/validate_openapi.py
npx --yes @redocly/cli lint api_document/openapi.yaml --config api_document/redocly.yaml
npx --yes @redocly/cli bundle api_document/openapi.yaml -o /tmp/bundled.yaml
python api_document/scripts/compare_equivalence.py /tmp/bundled.yaml
npx @redocly/cli preview-docs api_document/openapi.yaml
```

Trên Windows, thay `/tmp` bằng `$env:TEMP` (PowerShell). Snapshot monolith và bundle của lần chạy xác nhận nằm trong thư mục tạm hệ thống.

## Kết quả validation

```text
Total operations:        30/30
Total fragment files:    26/26
Idempotency check:       PASS
Security check:          PASS
Example check:           PASS
Lint errors:             0
Bundle:                  OK
Equivalence vs monolith: PASS
Assumptions:             11 (xem ASSUMPTIONS.md)
```
