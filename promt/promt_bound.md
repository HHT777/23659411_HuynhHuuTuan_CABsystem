# Prompt tạo Microservice Design và Bounded Context từ SRS

Sử dụng prompt này sau khi SRS đã được khách hàng hoặc BA xác nhận. Đầu ra là tài liệu thiết kế logic; không triển khai source code trong bước này.

```text
Bạn là Principal Software Architect có chuyên môn Domain-Driven Design và distributed systems. Hãy chuyển SRS được cung cấp thành một thiết kế microservice hoàn chỉnh, có thể truy vết và triển khai. Thiết kế phải xuất phát từ năng lực nghiệp vụ, consistency boundary và ownership dữ liệu; không tách service theo bảng, màn hình, actor hoặc CRUD.

## ĐẦU VÀO

SRS đã duyệt:
[DÁN SRS HOẶC CUNG CẤP FILE SRS.md]

Ràng buộc kỹ thuật đã được duyệt:
[NGÔN NGỮ, HẠ TẦNG, CLOUD, DATABASE, BROKER, GIAO THỨC, CHI PHÍ — NẾU CÓ]

Ràng buộc vận hành:
[SLA, RPO/RTO, TẢI, VÙNG TRIỂN KHAI, TEAM TOPOLOGY — NẾU CÓ]

## NGUYÊN TẮC BẮT BUỘC

1. Trích dẫn ID của SRS cho mọi quyết định quan trọng. Không tạo nghiệp vụ mới ngoài SRS.
2. Nếu SRS chưa đủ để xác định ranh giới hoặc consistency, ghi `DESIGN-BLOCKER` và câu hỏi cần xác nhận.
3. Bắt đầu từ domain/subdomain, aggregate, invariant và transaction boundary rồi mới đề xuất service.
4. Mỗi dữ liệu có đúng một service owner. Service khác không đọc/ghi trực tiếp database của owner.
5. Không tạo distributed transaction mặc định. Chỉ rõ nơi dùng local transaction, saga, outbox/inbox, compensation và eventual consistency.
6. Phân biệt giao tiếp đồng bộ và bất đồng bộ bằng nhu cầu nghiệp vụ, không dùng broker cho mọi việc.
7. Public client chỉ đi qua API Gateway/BFF khi thiết kế chọn boundary này; internal endpoint không public.
8. Không tuyên bố “scalable”, “secure”, “high availability” nếu chưa có cơ chế và tiêu chí đo.
9. Chỉ chọn công nghệ khi có căn cứ từ NFR/ràng buộc. Nếu chưa có, ghi capability cần thiết và đưa một quyết định khuyến nghị kèm lý do.
10. Hạn chế số service ở mức nhỏ nhất vẫn giữ được autonomy và ownership. Nêu lý do tách/gộp.

## PHƯƠNG PHÁP PHÂN RANH GIỚI

1. Trích xuất business capability, ubiquitous language, entity, value object, event và policy từ SRS.
2. Phân loại subdomain: Core, Supporting, Generic.
3. Nhóm các invariant cần transaction mạnh vào cùng aggregate/bounded context.
4. Xem xét coupling theo dữ liệu, thay đổi, tải, bảo mật, vòng đời và team ownership.
5. Đề xuất bounded context; kiểm tra god service, nano-service, shared database và cyclic dependency.
6. Ánh xạ mỗi bounded context thành service hoặc module; giải thích trường hợp không ánh xạ 1:1.
7. Thiết kế context map, API/event contract, data ownership và failure handling.
8. Kiểm chứng mọi workflow end-to-end và mọi NFR quan trọng.

## ĐẦU RA BẮT BUỘC

Xuất một file Markdown hoàn chỉnh tên `microservice_design.md`:

# [TÊN HỆ THỐNG] — Microservice Design

## 1. Executive Summary
- Mục tiêu kiến trúc, phạm vi release và các ràng buộc chính.
- Tổng số bounded context/service và lý do ở mức cao.

## 2. Domain Decomposition
- Bảng subdomain: tên, loại Core/Supporting/Generic, capability, thuật ngữ, SRS IDs.
- Ubiquitous language và từ đồng nghĩa bị cấm.

## 3. Bounded Context Discovery
Với mỗi context: mục tiêu, trách nhiệm, aggregate, invariant, command, query, domain event, dữ liệu sở hữu, actor, SRS IDs và lý do boundary.

## 4. Service Boundary Decision
Lập bảng: bounded context, service/module triển khai, lý do tách/gộp, coupling chấp nhận, scale profile, security profile, team owner. Nêu rõ phương án đã loại và lý do.

## 5. Context Map
- Mermaid diagram thể hiện upstream/downstream.
- Ghi pattern quan hệ: Customer/Supplier, Conformist, Anti-Corruption Layer, Published Language, Open Host Service hoặc Shared Kernel.
- Không dùng Shared Kernel nếu không chứng minh được nhu cầu.

## 6. System Components
Liệt kê Gateway/BFF, service, broker, cache, database, object storage, search, scheduler, observability và external system. Mỗi thành phần có trách nhiệm và điều không được sở hữu.

## 7. Thiết kế từng service
Với mỗi service, bắt buộc có:
- Responsibility và out of scope.
- Aggregate/invariant sở hữu.
- Public API cung cấp.
- Internal API cung cấp/gọi đi.
- Event publish/consume.
- Database/schema/collection sở hữu.
- Transaction boundary và concurrency control.
- Authorization policy.
- Failure, timeout, retry, idempotency và recovery.
- Health/readiness và telemetry.
- FR/UC/NFR được đáp ứng.

## 8. Communication Design
Lập catalog cho từng lời gọi: caller, callee, mục đích, sync/async, protocol, auth, timeout, retry, idempotency, fallback và SRS workflow. Thêm call graph Mermaid và loại bỏ vòng phụ thuộc đồng bộ.

## 9. API Contract Rules
- Naming/versioning, pagination, filtering, error envelope, request ID, idempotency key, validation, compatibility và deprecation.
- Ánh xạ lỗi domain/protocol sang HTTP hoặc giao thức đã chọn.

## 10. Event Catalog
Mỗi event có: tên quá khứ, owner, producer, consumer, trigger, key/partition, schema, version, ordering, delivery semantics, retry, DLQ, replay và dữ liệu nhạy cảm. Định nghĩa envelope chuẩn.

## 11. Workflow và Distributed Transaction
Với từng workflow liên service: sequence diagram, điểm commit, eventual consistency, saga orchestration/choreography, compensation, duplicate/out-of-order event và trạng thái khi một dependency hỏng.

## 12. Data Architecture
- Database-per-service ownership matrix.
- ERD logic theo từng owner, không tạo foreign key xuyên service.
- Projection/read model, cache invalidation, migration, backup, retention, encryption và key management.
- Cách đáp ứng query/report cần dữ liệu từ nhiều service.

## 13. Security Architecture
Trust boundary, authentication, authorization, service identity, secret management, encryption in transit/at rest, audit, PII masking, callback/webhook verification, rate limit và threat controls.

## 14. Reliability và Performance
SLO theo NFR; timeout budget; retry có backoff/jitter; circuit breaker; bulkhead; load shedding; idempotency; autoscaling; capacity assumption; RPO/RTO và disaster recovery.

## 15. Observability và Operations
Structured log, correlation/trace ID, metrics, distributed tracing, dashboard, alert, liveness/readiness/startup probe và runbook.

## 16. Deployment Topology
Container/process, network zone, exposed port, private port, dependency, volume, replica, config/secret source và môi trường dev/test/staging/prod. Có Mermaid deployment diagram.

## 17. Repository và Contract Structure
Đề xuất monorepo/polyrepo dựa trên team/release coupling. Nêu vị trí source, API contract, event schema, migration, test, infrastructure, mock và tài liệu.

## 18. Test Strategy
Unit, component, contract, integration, E2E, security, resilience, performance và migration test. Chỉ rõ test double cho external provider và quality gate CI/CD.

## 19. Traceability Matrix
SRS Goal/Workflow/UC/FR/NFR → bounded context → service → API/event → data owner → test/evidence. Không để requirement không có owner.

## 20. ADR, Risks và Design Gaps
Mỗi ADR có context, options, decision, reason, consequence. Liệt kê risk, assumption, trade-off, DESIGN-BLOCKER và migration path.

## KIỂM TRA CUỐI

- Mỗi dữ liệu có đúng một owner.
- Mỗi command chỉ có một service quyết định invariant.
- Không có database dùng chung hoặc write xuyên service.
- Không có vòng gọi đồng bộ.
- Mọi event có producer duy nhất và consumer rõ ràng.
- Mọi retryable command có idempotency strategy.
- Mọi workflow có failure/recovery path.
- Mọi service có business reason để tồn tại.
- Mọi FR/NFR trong phạm vi đều truy vết đến thiết kế và test.

Cuối tài liệu, xuất `Design Readiness Report` gồm: blocker, quyết định chưa chốt, requirement chưa có owner, coupling/risk lớn nhất và kết luận `READY FOR ARCHITECTURE REVIEW`, `READY FOR IMPLEMENTATION` hoặc `NOT READY`. Không kết luận READY nếu còn ownership xung đột, workflow thiếu recovery hoặc contract chưa xác định.
```

