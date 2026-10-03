# Cây thư mục thực tế của CAB System

Cây dưới đây phản ánh repository tại ngày 03/10/2026. Mỗi thư mục và tệp được liệt kê đều có chú thích sau ký tự `#`.

Không liệt kê `.git/`, `node_modules/`, `.env`, `.secrets/`, Docker volume và file sinh tạm vì đây là metadata, dependency hoặc dữ liệu nhạy cảm cục bộ, không phải source của hệ thống.

```text
23659411_HuynhHuuTuan_CABsystem/                         # Thư mục gốc của hệ thống đặt xe CAB
├── .github/                                             # Cấu hình cộng tác và CI trên GitHub
│   ├── agents/                                         # Khai báo agent hỗ trợ phát triển
│   │   └── cab-system-builder.agent.md                 # Chỉ dẫn cho agent xây dựng CAB System
│   └── workflows/                                      # Các pipeline GitHub Actions
│       └── ci.yml                                      # Pipeline kiểm tra source khi push/PR
├── api_document/                                       # Đặc tả OpenAPI theo microservice
│   ├── api-traceability.md                             # Ma trận truy vết API với yêu cầu
│   ├── booking-service.yaml                            # API booking, báo giá và offer
│   ├── customer-service.yaml                           # API hồ sơ khách hàng
│   ├── driver-service.yaml                             # API hồ sơ, OTP và vị trí tài xế
│   ├── identity-service.yaml                           # API đăng ký và đăng nhập
│   ├── notification-service.yaml                       # API thông báo
│   ├── payment-service.yaml                            # API thanh toán và callback
│   ├── trip-service.yaml                               # API chuyến đi và đánh giá
│   └── README.md                                       # Hướng dẫn bộ tài liệu API
├── backend/                                            # Toàn bộ mã nguồn backend
│   ├── gateway/                                        # Public API Gateway tại cổng 8000
│   │   ├── src/                                        # Mã nguồn thực thi Gateway
│   │   │   ├── config/                                 # Cấu hình Gateway
│   │   │   │   ├── env.js                             # Nạp biến môi trường
│   │   │   │   └── redis.js                           # Cấu hình Redis
│   │   │   ├── grpc/                                   # Thành phần giao tiếp gRPC dự kiến
│   │   │   │   ├── clients.js                         # Khởi tạo RPC clients
│   │   │   │   ├── error-info.js                      # Chuẩn hóa chi tiết lỗi RPC
│   │   │   │   ├── health.client.js                   # Client kiểm tra gRPC health
│   │   │   │   ├── metadata.js                        # Tạo metadata cho RPC
│   │   │   │   ├── route-rpc-map.js                   # Ánh xạ REST route sang RPC
│   │   │   │   └── status-to-http.js                  # Chuyển gRPC status sang HTTP
│   │   │   ├── infrastructure/                         # Thành phần kỹ thuật Gateway
│   │   │   │   └── logger.js                          # Logger của Gateway
│   │   │   ├── middlewares/                            # Middleware bảo mật và request
│   │   │   │   ├── auth.middleware.js                 # Xác thực access token
│   │   │   │   ├── block-internal.middleware.js       # Chặn public `/internal/*`
│   │   │   │   ├── error.middleware.js                # Chuẩn hóa response lỗi
│   │   │   │   ├── rate-limit.middleware.js           # Giới hạn tần suất request
│   │   │   │   ├── rbac.middleware.js                 # Phân quyền theo vai trò
│   │   │   │   └── request-id.middleware.js           # Sinh và truyền request ID
│   │   │   ├── routes/                                 # Các nhóm public route
│   │   │   │   ├── admin-driver.routes.js             # Route quản trị tài xế
│   │   │   │   ├── auth.routes.js                     # Route đăng ký/đăng nhập
│   │   │   │   ├── booking.routes.js                  # Route booking/báo giá
│   │   │   │   ├── customer.routes.js                 # Route khách hàng
│   │   │   │   ├── driver.routes.js                   # Route tài xế
│   │   │   │   ├── health.routes.js                   # Route health/readiness
│   │   │   │   ├── notification.routes.js             # Route thông báo
│   │   │   │   ├── offer.routes.js                    # Route offer
│   │   │   │   ├── payment.routes.js                  # Route thanh toán
│   │   │   │   └── trip.routes.js                     # Route chuyến đi
│   │   │   ├── services/                               # Dịch vụ hỗ trợ Gateway
│   │   │   │   └── service-credential.service.js      # Credential gọi service nội bộ
│   │   │   ├── app.js                                  # Express app, auth, rate limit và proxy
│   │   │   └── index.js                                # Entrypoint Gateway
│   │   ├── tests/                                      # Kiểm thử Gateway
│   │   │   ├── contract/                               # Contract tests
│   │   │   │   └── route-rpc.test.js                  # Kiểm tra ownership của API route
│   │   │   └── integration/                            # Integration tests
│   │   │       └── payment-raw-body.test.js            # Kiểm tra raw body callback HMAC
│   │   ├── .dockerignore                               # Loại file khỏi build context
│   │   ├── .env.example                                # Biến môi trường mẫu Gateway
│   │   ├── Dockerfile                                  # Công thức build image Gateway
│   │   ├── package-lock.json                           # Khóa phiên bản dependency Gateway
│   │   ├── package.json                                # Metadata/dependency Gateway
│   │   └── README.md                                   # Hướng dẫn Gateway
│   ├── infra/                                          # Script khởi tạo hạ tầng
│   │   ├── kafka/                                      # Hạ tầng Apache Kafka
│   │   │   └── create-topics.sh                        # Tạo topic nghiệp vụ và DLQ
│   │   ├── mongodb/                                    # Hạ tầng MongoDB
│   │   │   └── init-replica-set.js                     # Khởi tạo replica set
│   │   └── postgres/                                   # Hạ tầng PostgreSQL
│   │       ├── init-databases.sql                      # Tạo database riêng cho service
│   │       └── init.sql                                # SQL khởi tạo nền tảng
│   ├── mocks/                                          # Dữ liệu giả lập provider ngoài
│   │   └── fixtures/                                   # Fixture JSON dùng khi test
│   │       ├── map-provider.json                       # Phản hồi giả lập bản đồ
│   │       ├── payment-provider.json                   # Phản hồi giả lập thanh toán
│   │       └── sms-provider.json                       # Phản hồi giả lập SMS
│   ├── scripts/                                        # Script vận hành backend
│   │   ├── check-contracts.js                          # Kiểm tra JSON/proto contract
│   │   ├── generate-jwt-keys.js                        # Sinh khóa RSA cho JWT local
│   │   ├── seed-demo.js                                # Tạo dữ liệu demo
│   │   └── smoke-test.js                               # Smoke test qua Gateway
│   ├── services/                                       # Bảy microservice nghiệp vụ
│   │   ├── identity-service/                           # Tài khoản, đăng ký, đăng nhập và JWT
│   │   │   ├── migrations/                             # Migration Identity DB
│   │   │   │   └── README.md                          # Trạng thái migration Identity
│   │   │   ├── src/                                    # Mã nguồn Identity
│   │   │   │   ├── api/                                # API layer Identity
│   │   │   │   │   ├── http/                          # HTTP nội bộ Identity
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Identity
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Identity
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Identity
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain tài khoản/xác thực
│   │   │   │   │   └── README.md                      # Mô tả domain Identity
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Identity
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Identity
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Identity
│   │   │   │   └── index.js                            # Entrypoint cổng 3000
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Identity
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Identity
│   │   ├── customer-service/                           # Hồ sơ và ownership khách hàng
│   │   │   ├── migrations/                             # Migration Customer DB
│   │   │   │   └── README.md                          # Trạng thái migration Customer
│   │   │   ├── src/                                    # Mã nguồn Customer
│   │   │   │   ├── api/                                # API layer Customer
│   │   │   │   │   ├── http/                          # HTTP nội bộ Customer
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Customer
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Customer
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Customer
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain hồ sơ khách hàng
│   │   │   │   │   └── README.md                      # Mô tả domain Customer
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Customer
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Customer
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Customer
│   │   │   │   └── index.js                            # Entrypoint cổng 3001
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Customer
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Customer
│   │   ├── driver-service/                             # OTP, hồ sơ, duyệt và vị trí tài xế
│   │   │   ├── migrations/                             # Migration Driver DB
│   │   │   │   └── README.md                          # Trạng thái migration Driver
│   │   │   ├── src/                                    # Mã nguồn Driver
│   │   │   │   ├── api/                                # API layer Driver
│   │   │   │   │   ├── http/                          # HTTP nội bộ Driver
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Driver
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Driver
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Driver
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain tài xế/vị trí
│   │   │   │   │   └── README.md                      # Mô tả domain Driver
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Driver
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Driver
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Driver
│   │   │   │   └── index.js                            # Entrypoint cổng 3002
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Driver
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Driver
│   │   ├── booking-service/                            # Báo giá, booking, offer và dispatch
│   │   │   ├── migrations/                             # Migration Booking DB
│   │   │   │   └── README.md                          # Trạng thái migration Booking
│   │   │   ├── src/                                    # Mã nguồn Booking
│   │   │   │   ├── api/                                # API layer Booking
│   │   │   │   │   ├── http/                          # HTTP nội bộ Booking
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Booking
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Booking
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Booking
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain booking/offer
│   │   │   │   │   └── README.md                      # Mô tả domain Booking
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Booking
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Booking
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Booking
│   │   │   │   └── index.js                            # Entrypoint cổng 3003
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Booking
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Booking
│   │   ├── trip-service/                               # Vòng đời chuyến, hủy, giá và review
│   │   │   ├── migrations/                             # Migration Trip DB
│   │   │   │   └── README.md                          # Trạng thái migration Trip
│   │   │   ├── src/                                    # Mã nguồn Trip
│   │   │   │   ├── api/                                # API layer Trip
│   │   │   │   │   ├── http/                          # HTTP nội bộ Trip
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Trip
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Trip
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Trip
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain trip/fare/review
│   │   │   │   │   └── README.md                      # Mô tả domain Trip
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Trip
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Trip
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Trip
│   │   │   │   └── index.js                            # Entrypoint cổng 3004
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Trip
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Trip
│   │   ├── payment-service/                            # Payment, HMAC callback và đối soát
│   │   │   ├── migrations/                             # Migration Payment DB
│   │   │   │   └── README.md                          # Trạng thái migration Payment
│   │   │   ├── src/                                    # Mã nguồn Payment
│   │   │   │   ├── api/                                # API layer Payment
│   │   │   │   │   ├── http/                          # HTTP nội bộ Payment
│   │   │   │   │   │   ├── health.routes.js           # Health/readiness Payment
│   │   │   │   │   │   └── service-auth.middleware.js # Xác thực service token
│   │   │   │   │   └── README.md                      # Mô tả API layer
│   │   │   │   ├── application/                        # Application layer Payment
│   │   │   │   │   └── README.md                      # Mô tả use case layer
│   │   │   │   ├── config/                             # Cấu hình Payment
│   │   │   │   │   └── env.js                         # Đọc biến môi trường
│   │   │   │   ├── domain/                             # Domain thanh toán
│   │   │   │   │   └── README.md                      # Mô tả domain Payment
│   │   │   │   ├── infrastructure/                     # Adapter kỹ thuật Payment
│   │   │   │   │   └── README.md                      # Mô tả infrastructure
│   │   │   │   ├── app.js                              # Tạo ứng dụng Payment
│   │   │   │   ├── bootstrap.js                        # Ghép dependency Payment
│   │   │   │   └── index.js                            # Entrypoint cổng 3005
│   │   │   ├── .dockerignore                           # Loại file khỏi image
│   │   │   ├── .env.example                            # Biến môi trường mẫu
│   │   │   ├── Dockerfile                              # Build image Payment
│   │   │   ├── package-lock.json                       # Khóa dependency
│   │   │   ├── package.json                            # Metadata/dependency
│   │   │   └── README.md                               # Hướng dẫn Payment
│   │   └── notification-service/                       # Hộp thư thông báo và trạng thái đã đọc
│   │       ├── migrations/                             # Migration/index MongoDB
│   │       │   └── README.md                           # Trạng thái migration Notification
│   │       ├── src/                                    # Mã nguồn Notification
│   │       │   ├── api/                                # API layer Notification
│   │       │   │   ├── http/                           # HTTP nội bộ Notification
│   │       │   │   │   ├── health.routes.js            # Health/readiness Notification
│   │       │   │   │   └── service-auth.middleware.js  # Xác thực service token
│   │       │   │   └── README.md                       # Mô tả API layer
│   │       │   ├── application/                        # Application layer Notification
│   │       │   │   └── README.md                       # Mô tả use case layer
│   │       │   ├── config/                             # Cấu hình Notification
│   │       │   │   └── env.js                          # Đọc biến môi trường
│   │       │   ├── domain/                             # Domain notification/delivery
│   │       │   │   └── README.md                       # Mô tả domain Notification
│   │       │   ├── infrastructure/                     # Adapter kỹ thuật Notification
│   │       │   │   └── README.md                       # Mô tả infrastructure
│   │       │   ├── app.js                              # Tạo ứng dụng Notification
│   │       │   ├── bootstrap.js                        # Ghép dependency Notification
│   │       │   └── index.js                            # Entrypoint cổng 3006
│   │       ├── .dockerignore                           # Loại file khỏi image
│   │       ├── .env.example                            # Biến môi trường mẫu
│   │       ├── Dockerfile                              # Build image Notification
│   │       ├── package-lock.json                       # Khóa dependency
│   │       ├── package.json                            # Metadata/dependency
│   │       └── README.md                               # Hướng dẫn Notification
│   ├── shared/                                         # Mã và contract dùng chung
│   │   ├── contracts/                                  # Hợp đồng dữ liệu giữa các thành phần
│   │   │   ├── proto/                                  # Protocol Buffer contract
│   │   │   │   ├── google/                             # Proto tương thích Google RPC
│   │   │   │   │   └── rpc/                            # Namespace lỗi Google RPC
│   │   │   │   │       └── error_details.proto         # Schema chi tiết lỗi RPC
│   │   │   │   ├── grpc/                               # Proto chuẩn gRPC
│   │   │   │   │   └── health/                         # Namespace health check
│   │   │   │   │       └── v1/                         # Phiên bản v1
│   │   │   │   │           └── health.proto            # Contract gRPC Health/Check
│   │   │   │   ├── booking.v1.proto                    # Contract Booking/Offer
│   │   │   │   ├── customer.v1.proto                   # Contract Customer
│   │   │   │   ├── driver.v1.proto                     # Contract Driver
│   │   │   │   ├── identity.v1.proto                   # Contract Identity/Auth
│   │   │   │   ├── notification.v1.proto               # Contract Notification
│   │   │   │   ├── payment.v1.proto                    # Contract Payment
│   │   │   │   ├── trip.v1.proto                       # Contract Trip/Review
│   │   │   │   └── README.md                           # Quy ước sử dụng proto
│   │   │   ├── api-errors.v1.json                      # Danh mục mã lỗi API
│   │   │   └── events.v1.json                          # Schema envelope sự kiện
│   │   ├── jwt.js                                       # Ký/xác minh JWT RS256
│   │   └── service-runtime.js                           # Runtime Express in-memory cho 7 service
│   ├── tests-audit/                                    # Bộ test QA/security độc lập
│   │   ├── docker-compose.audit.yml                    # Override chỉ dùng khi audit
│   │   ├── rate-limit-audit.mjs                        # Kiểm tra burst và recovery
│   │   ├── restart-idempotency.ps1                     # Kiểm tra replay sau restart
│   │   └── runtime-audit.mjs                           # Test nghiệp vụ/bảo mật PC3-PC30
│   ├── package-lock.json                               # Khóa dependency npm workspace
│   ├── package.json                                    # Khai báo npm workspace backend
│   └── README.md                                       # Hướng dẫn backend
├── document/                                           # Báo cáo và hướng dẫn kiểm thử
│   └── tieuchi.md                                      # Báo cáo audit PC1-PC30
├── .env.example                                        # Cấu hình môi trường mẫu root
├── .gitignore                                          # Loại secret, dependency và log
├── audit.md                                            # Ghi chú audit backend
├── audit_30_tieu_chi.md                                # Đối chiếu chi tiết 30 tiêu chí
├── cau_truc_thu_muc.md                                 # Tài liệu cây thư mục này
├── docker-compose.yml                                  # Gateway, 7 service và hạ tầng Docker
├── microservice_design.md                              # Thiết kế kiến trúc microservice
├── phieucham.md                                        # Phiếu chấm PC1-PC30
├── README.md                                           # Giới thiệu repository
└── SRS.md                                              # Đặc tả yêu cầu phần mềm
```

## Ghi chú hiện trạng

- Gateway là cổng public duy nhất; các service nghiệp vụ chỉ `expose` trong Docker network.
- Bảy service hiện dùng `backend/shared/service-runtime.js` và `STORAGE_MODE=memory`; các thư mục `domain`, `application`, `infrastructure`, `migrations` chủ yếu chứa README định hướng.
- Contract gRPC đã có trong `shared/contracts/proto`, nhưng runtime nghiệp vụ hiện đi qua Internal REST.
- PostgreSQL, MongoDB, Redis và Kafka đã có container/init script; durable repository và Kafka producer/consumer nghiệp vụ chưa được nối vào runtime.
