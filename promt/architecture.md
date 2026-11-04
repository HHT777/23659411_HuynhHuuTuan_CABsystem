# Prompt tạo sơ đồ kiến trúc microservice hoàn chỉnh

Prompt này tạo bộ sơ đồ có thể render bằng Mermaid. Đầu vào ưu tiên là SRS và `microservice_design.md` đã duyệt.

```text
Bạn là Solution Architect. Hãy tạo bộ sơ đồ kiến trúc microservice hoàn chỉnh từ tài liệu được cung cấp. Sơ đồ phải phản ánh đúng component, boundary, ownership, protocol và deployment trong tài liệu; không tự thêm service, database, broker hoặc công nghệ chỉ để sơ đồ trông đầy đủ.

## ĐẦU VÀO

SRS:
[DÁN SRS HOẶC CUNG CẤP FILE]

Microservice Design:
[DÁN THIẾT KẾ HOẶC CUNG CẤP FILE]

Môi trường cần mô tả:
[LOCAL / TEST / STAGING / PRODUCTION]

## QUY TẮC

1. Đọc và lập inventory trước khi vẽ: actor, external system, edge component, service, data store, broker/topic, cache, object storage, observability và deployment unit.
2. Không gộp hai thành phần có ownership khác nhau thành một box.
3. Không vẽ client gọi trực tiếp service nội bộ nếu thiết kế yêu cầu qua Gateway/BFF.
4. Mỗi database đặt sát service owner và ghi rõ `owned by`; không vẽ database dùng chung nếu tài liệu không cho phép.
5. Mỗi mũi tên phải có hướng, mục đích và protocol. Phân biệt sync request, async event và admin/observability traffic bằng nét hoặc nhãn.
6. Sơ đồ không được mâu thuẫn về tên service, port, protocol, topic, data owner hoặc trust boundary giữa các view.
7. Nếu tài liệu thiếu thông tin, dùng `TBD` và ghi Architecture Gap; không tự đoán.
8. Mermaid phải hợp lệ, ID node không chứa khoảng trắng/ký tự dễ làm lỗi; label có thể dùng tiếng Việt.
9. Giữ mỗi sơ đồ đọc được. Nếu quá 15 node, tách theo domain/workflow thay vì thu nhỏ tất cả vào một hình.

## ĐẦU RA

Xuất một file Markdown tên `architecture.md` theo cấu trúc:

# [TÊN HỆ THỐNG] — Architecture Diagrams

## 1. Legend và quy ước
Giải thích màu/nhãn/đường cho public, internal, external, sync, async, data store, trust boundary và owner.

## 2. C4 System Context
Dùng Mermaid `flowchart`. Thể hiện actor, hệ thống đang thiết kế và external systems. Mỗi quan hệ có mục đích nghiệp vụ, không đưa chi tiết container vào view này.

## 3. C4 Container/Microservice View
Dùng Mermaid `flowchart` với subgraph: Clients, Edge, Internal Services, Messaging, Data, External Providers và Observability. Thể hiện toàn bộ service cùng database owner và giao tiếp chính.

## 4. Bounded Context Map
Vẽ context và quan hệ upstream/downstream; ghi pattern DDD và published language/ACL.

## 5. Public Request Flow
Vẽ sequence diagram cho một request đại diện: Client → Gateway/BFF → owner service → data/dependency → response. Có authentication, authorization, request ID, timeout và error path.

## 6. Core Business Workflows
Với mỗi workflow quan trọng trong SRS, tạo một sequence diagram riêng. Thể hiện actor, service owner, local commit, event, consumer, notification, failure, retry và compensation. Không bỏ qua nhánh từ chối quan trọng.

## 7. Event-driven Architecture
Vẽ producer → topic/event → consumer; ghi event name, partition/key nếu đã xác định, retry/DLQ và projection. Không vẽ service publish event mà thiết kế không định nghĩa.

## 8. Data Ownership View
Vẽ service → owned database/schema/collection và read model/cache. Dùng đường đứt cho dữ liệu nhận qua API/event; đánh dấu mọi vi phạm shared database nếu phát hiện.

## 9. Security và Trust Boundaries
Vẽ Internet, edge zone, application zone, data zone, management/observability zone và external providers. Ghi TLS, JWT/session, service credential, secret store, encryption key, webhook signature, RBAC/ABAC và audit path theo thiết kế.

## 10. Deployment Diagram
Dùng Mermaid `flowchart`. Thể hiện DNS/load balancer/ingress, Gateway, service replicas, broker, cache, database, secret/config, volume, monitoring và external provider. Ghi exposed/private port và health probe nếu đã có trong tài liệu.

## 11. Failure và Recovery View
Vẽ ít nhất các trường hợp: dependency timeout, broker unavailable, duplicate request/event, service restart và database failure. Chỉ rõ timeout, retry, circuit breaker, idempotency, DLQ, replay, compensation và degraded behavior.

## 12. Traceability Table
Lập bảng: Diagram/View → node/flow → service owner → SRS ID → design section. Mọi service và core workflow phải xuất hiện trong ít nhất một view chi tiết.

## 13. Architecture Gaps
Liệt kê thông tin thiếu, mâu thuẫn giữa SRS và design, node không có owner, kết nối không có protocol, dữ liệu không có owner và workflow không có failure path.

## KIỂM TRA MERMAID VÀ NHẤT QUÁN

- Mọi code block Mermaid có cú pháp đóng/mở đầy đủ.
- Tên node ổn định giữa các sơ đồ.
- Mũi tên đúng chiều và có nhãn.
- Public/private boundary rõ ràng.
- Database owner nhất quán.
- Sync/async không bị trộn.
- Không có component “trang trí” không truy vết được về tài liệu.
- Sơ đồ deployment khớp container/process thực sự dự kiến chạy.

Kết thúc bằng `Architecture Diagram Readiness`: số view đã tạo, số gap, mâu thuẫn phát hiện và kết luận `READY TO RENDER`, `READY WITH TBD` hoặc `NOT READY`.
```

