# CAB SYSTEM — AUDIT 30 TIÊU CHÍ

> **Mục đích:** Audit tài liệu v3.1 và kế hoạch kiểm chứng backend tương lai, đối chiếu một bộ `SRS` + `Microservice Design` + mã nguồn/triển khai với 30 tiêu chí trong `phieucham.md`.
>
> **Phạm vi lần này:** Đã đọc SRS, Microservice Design, phiếu chấm và template. Không có source/Compose/database/log/Postman execution được cung cấp hoặc chạy. PASS chỉ dùng cho phạm vi tài liệu được nêu rõ; không có PC nào được đánh PASS toàn bộ.
>
> **Nguyên tắc:** Không suy đoán. Chỉ kết luận PASS/FAIL/PARTIAL khi có bằng chứng từ tài liệu, source code, Docker/Compose, database, log hoặc Postman execution.

---

## 1. Thông tin audit

| Trường | Giá trị |
|---|---|
| Project | CAB System |
| Auditor | Codex — rà tài liệu và sửa baseline |
| Audit date | 01/10/2026 (Asia/Ho_Chi_Minh) |
| SRS version | v3.1; baseline trước sửa v3.0 |
| Microservice Design version | v3.1; baseline trước sửa v3.0 |
| Source commit / branch | Chưa có / chưa xác minh |
| Rubric | `phieucham.md` — PC1–PC30 |
| Overall status | PARTIAL — tài liệu phủ 30/30; runtime chưa kiểm chứng |

### Tài liệu đầu vào

| Tài liệu | Path / URL | Version | Đã kiểm tra |
|---|---|---|---|
| SRS | srs.md | 3.1 | Có, toàn bộ phần liên quan PC và contracts |
| Microservice Design | microservice_design.md | 3.1 | Có, ranh giới/flow/schema/recovery |
| Phiếu chấm | upload/phieucham.md | Bản được gửi | Có, đủ PC1–PC30 |
| Template audit | upload/audit_30_tieu_chi_template.md | Bản được gửi | Có, dùng cấu trúc mục 1–11 |
| Source code | Chưa cung cấp | — | Không; không tự dùng repo cũ để thay bằng chứng |
| Docker Compose | Chưa cung cấp | — | Không |
| Postman / test evidence | Chưa cung cấp | — | Không |

---

# 2. Quy ước trạng thái

| Status | Ý nghĩa |
|---|---|
| `PASS` | Đáp ứng đầy đủ tiêu chí và có bằng chứng đủ mạnh |
| `PARTIAL` | Có triển khai/mô tả nhưng còn thiếu hoặc chưa chứng minh đầy đủ |
| `FAIL` | Không đáp ứng hoặc có bằng chứng ngược lại |
| `N/A` | Không áp dụng, chỉ dùng khi có lý do rõ ràng |
| `PENDING` | Chưa đủ bằng chứng để kết luận |

**Ba lớp kết luận:**

- `Document status`: đủ mô tả/nhất quán để làm cơ sở triển khai; PASS chỉ cho lớp này, không phải điểm chấm.
- `Runtime status`: source/DB/Compose/request-response chưa có → PENDING.
- `Status` tổng thể từng PC: PARTIAL vì đã có bằng chứng tài liệu nhưng chưa chứng minh đầy đủ điều kiện thực hành. Không có N/A, không bỏ tiêu chí.

**Độ bao phủ yêu cầu:** 30/30. **Mức sẵn sàng tài liệu sau sửa:** 26 PASS, 4 PARTIAL (PC4, PC5, PC16, PC21). **Runtime:** 30 PENDING. Đây là hai phép phân loại theo phạm vi khác nhau, không cộng chúng thành số điểm.

> **Lưu ý:** `PENDING` không được tự động xem là PASS.

---

# 3. Kiểm tra nhất quán kiến trúc

Phần này dùng để kiểm tra SRS ↔ Microservice Design ↔ Source Code trước khi đi vào từng PC.

| Hạng mục | SRS | Microservice Design | Source Code / Runtime | Status | Evidence / Gap |
|---|---|---|---|---|---|
| Số lượng service / bounded context | SRS §5/15.1 | micro §1.6 | Chưa kiểm, PENDING | PASS (tài liệu) | 7 service vật lý; các context Booking+Assignment, Trip+Fare+Review gộp theo prompt, không tách thêm process; runtime cần G01–G07 |
| Tên service và trách nhiệm | SRS §15.1 | micro §5.1–5.7 | Chưa kiểm, PENDING | PASS (tài liệu) | Identity/Customer/Driver/Booking/Trip/Payment/Notification nhất quán; runtime cần G01–G07 |
| Gateway / entry point | SRS §14.1/16.2.1 | micro §5.0/10.2 | Chưa kiểm, PENDING | PASS (tài liệu) | Chỉ Gateway host port; internal routes không public; runtime cần G01–G07 |
| IPC đồng bộ | SRS §14.1/16.2 | micro §2/9.6 | Chưa kiểm, PENDING | PARTIAL (tài liệu) | REST credential HS256; call graph không vòng; config registration/reservation còn gate; runtime cần G01–G07 |
| IPC bất đồng bộ / messaging | SRS §12 | micro §7/9.1/9.6 | Chưa kiểm, PENDING | PASS (tài liệu) | 13 event; outbox/inbox, manual offset, namespace version; runtime cần G01–G07 |
| Database ownership | SRS §13/15 | micro §4/8 | Chưa kiểm, PENDING | PASS (tài liệu) | 6 PostgreSQL DB logic + Mongo Notification; không FK/read xuyên owner; runtime cần G01–G07 |
| Redis / cache / transient data | SRS §6.4/13.3/16.2.1 | micro §9.6/10.2 | Chưa kiểm, PENDING | PASS (tài liệu) | Rate/OTP/GEO/reservation/tracking; DB quyết định reservation; không atomic xuyên Redis+SQL; runtime cần G01–G07 |
| Provider bên ngoài / mock provider | SRS §6.9/16.2.1 | micro §10.4/9.6 | Chưa kiểm, PENDING | PARTIAL (tài liệu) | Map/Payment/SMS adapter; stable provider reference; callback qua Gateway; runtime cần G01–G07 |
| Service boundary không mâu thuẫn | SRS §14–15 | micro §1.6/2/5 | Chưa kiểm, PENDING | PASS (tài liệu) | Không vòng call; ownership độc lập; profile token mapping sửa v3.1; runtime cần G01–G07 |
| Fare ownership | SRS §6.5/6.6/BRULE-09 | micro §5.5/9.6 | Chưa kiểm, PENDING | PASS (tài liệu) | Trip tính và khóa; Payment đọc; client amount bị từ chối; runtime cần G01–G07 |
| Booking / Dispatch / Assignment ownership | SRS §6.5/6.6 | micro §5.4/9.6 | Chưa kiểm, PENDING | PASS (tài liệu) | Booking giữ Offer/Assignment; reserve trước Offer; CONFIRMED recovery không tự expiry; runtime cần G01–G07 |
| Review ownership | SRS FR-24/25; §13 | micro §5.5 | Chưa kiểm, PENDING | PASS (tài liệu) | Trip sở hữu; Driver rating projection inbox dedupe; runtime cần G01–G07 |
| P1 / P2 boundary | SRS §5/14.2/15 | micro §1.5/10.2 | Chưa kiểm, PENDING | PASS (tài liệu) | Admin duyệt Driver P1; backoffice-service (P2) ngoài registry; không build P2 trong vòng này; runtime cần G01–G07 |

### Architecture findings

Kiến trúc đủ cơ sở để bắt đầu xây backend theo lớp contract/infrastructure. Chưa đủ bằng chứng để cam kết chạy được 30 PC ngay. Các lỗi v3.0 đã sửa ở baseline v3.1; các cấu hình và lựa chọn còn thiếu được ghi thành gate, không dùng giả định như kết quả triển khai.

Các quyết định cố định giữ nguyên: 7 service P1, Internal REST + Kafka, Trip sở hữu Fare/Review, Booking sở hữu Assignment, Payment sau Trip COMPLETED và client không amount. Lần audit này không xây/chỉnh backend.

---

# 4. Audit 30 tiêu chí

## PC1 — Mô tả kiến trúc tổ chức source code

**Rubric:** Mô tả kiến trúc tổ chức source code.

**Cần kiểm tra:**

- Cấu trúc thư mục/project có rõ ràng.
- Có phân tách gateway, services, infrastructure/supporting components nếu tài liệu yêu cầu.
- Mỗi service có source code thực tế, không phải thư mục rỗng.
- README/tài liệu mô tả được cấu trúc.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §14–15; FR-01/NFR-03/08; §17 PC1; E-002 micro §10.1/10.2; §11 PC1; E-003 phiếu PC1 |
| Finding | Cây source có gateway, 7 owner và các lớp API/application/domain/infrastructure; chưa có mã nguồn được cung cấp. |
| Gap | Tree/repo commit, README, route code và migrations của từng service phải tồn tại thật; không chỉ thư mục rỗng. |
| Recommendation | Dựng skeleton có executable entrypoint và module health; đối chiếu mỗi folder với 7 service. |

---

## PC2 — Kiểm tra `.gitignore` và `.env` trên GitHub

**Rubric:** Kiểm tra `.gitignore` và `.env` trên GitHub.

**Cần kiểm tra:**

- Secret thực không bị commit.
- `.env` đúng phạm vi ignore.
- Có `.env.example` hoặc tài liệu cấu hình tương ứng nếu yêu cầu.
- Không có credential/API key/password nhạy cảm trong repo.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §16.0 NFR-03/SEC-10; §17 PC2; E-002 micro §10.1/.gitignore; §10.3; §11 PC2; E-003 phiếu PC2 |
| Finding | Có .env.example/ignore secrets, phân tách khóa và quy tắc không commit secret; chưa quét repo/lịch sử Git. |
| Gap | git ls-files và secret scan cả current tree/lịch sử; chỉ cấu hình mẫu không secret thật. |
| Recommendation | Khi có source, chạy scan trước đẩy Git; secret lộ phải rotate, không chỉ xóa file. |

---

## PC3 — Mô tả nhiệm vụ Gateway trong hệ thống

**Rubric:** Mô tả nhiệm vụ gateway trong hệ thống.

**Cần kiểm tra:**

- Gateway là entry point cho client.
- Routing/proxy được mô tả và triển khai nhất quán.
- Authentication/authorization hoặc trách nhiệm cross-cutting được xác định rõ.
- Không đẩy nghiệp vụ domain vào gateway nếu thiết kế yêu cầu domain nằm ở service.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §14.1; §16.2.1/16.3; §17 PC3; E-002 micro §5.0/9.2/9.6; §11 PC3; E-003 phiếu PC3 |
| Finding | Gateway routing/JWT/RBAC/rate/tracing; domain ở owner. Header caller tự khai bị loại và credential được Gateway gắn lại. |
| Gap | Config routing, auth middleware và trace request; chứng minh Gateway không tính Fare/dispatch. |
| Recommendation | Implement cùng catalog routes; test header spoof và ownership ở owner. |

---

## PC4 — Mô tả IPC của các microservice

**Rubric:** Mô tả IPC của các microservice.

**Cần kiểm tra:**

- Có mô tả cách service gọi service khác.
- Phân biệt synchronous IPC và asynchronous messaging nếu hệ thống có cả hai.
- Hợp đồng API/event có đủ để triển khai.
- Có cơ chế authentication/credential cho internal communication khi được yêu cầu.

| Field | Audit |
|---|---|
| Document status | PARTIAL — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §14.1; §16.2/16.2.1; §12; §17 PC4; E-002 micro §2/5/7/9.6; §11 PC4; E-003 phiếu PC4 |
| Finding | REST + Kafka phân biệt; call graph acyclic; 10 internal contracts có allowlist. Signing registration và reservation vẫn có gate C02/C04. |
| Gap | Chốt G02/G04; request/response credential hợp lệ/sai, event sample/group/consume và cùng commit. |
| Recommendation | Chốt registration signing/key và lease parameters trước hoàn tất flow Driver/assignment. |

---

## PC5 — Compose hệ thống và liệt kê các container

**Rubric:** Compose hệ thống và liệt kê các container.

**Cần kiểm tra:**

- `docker-compose.yml` / Compose tương ứng.
- Liệt kê được application services, databases, messaging, cache, mocks nếu có.
- Port exposure đúng kiến trúc.
- Network, volume, dependency/healthcheck phù hợp.

| Field | Audit |
|---|---|
| Document status | PARTIAL — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §14.2; NFR-03; §17 PC5; E-002 micro §10.2/10.3; §9.6 G01; §11 PC5; E-003 phiếu PC5 |
| Finding | Registry khớp số container được định nghĩa; chỉ Gateway publish. Đây là profile thiết kế, chưa có Compose; internal ports/image/Kafka mode còn C01/C05/C10. |
| Gap | docker compose config/ps và healthchecks; network/volumes/listeners; Mongo replica-set; count thực tế khớp tài liệu. |
| Recommendation | Chốt version/image/port nội bộ; dựng Compose từ registry, không đưa P2 vào. |

---

## PC6 — POSTMAN: API health check

**Rubric:** Gọi `/health`, `/ready`, `/health/services`.

**Kết quả mong đợi:** Endpoint trả trạng thái healthy/ready và danh sách service.

**Cần kiểm tra:**

- Endpoint tồn tại đúng tài liệu.
- Response thực tế hợp lệ.
- Health/ready phân biệt đúng nếu có.
- Aggregate service health hoạt động nếu rubric yêu cầu.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-01/FR-01; §16.0/16.2.1; §17 PC6; E-002 micro §5.0/9.5/10.2; §11 PC6; E-003 phiếu PC6 |
| Finding | Phân biệt process liveness và dependency readiness; response service list; sửa UC-01 tránh /health phải 503 khi DB down. |
| Gap | GET /health,/ready,/health/services 200; tắt dependency và ghi /health 200,/ready 503; phục hồi /ready 200. |
| Recommendation | Postman và fault test health theo contract; không gọi chỉ một endpoint rồi kết luận. |

---

## PC7 — Kiểm tra hệ thống Kafka / RabbitMQ

**Rubric:** Kiểm tra hệ thống messaging broker.

**Cần kiểm tra:**

- Broker được triển khai/cấu hình.
- Topic/queue/exchange phù hợp tài liệu.
- Producer/consumer hoạt động.
- Có bằng chứng message được publish/consume.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §12 catalog/envelope; NFR-06; §17 PC7; E-002 micro §7/9.1/9.6; §11 PC7; E-003 phiếu PC7 |
| Finding | 13 event catalog, topics/group drafts, outbox/inbox và DLQ; không nói broker tự bảo đảm transaction ngoài Kafka. |
| Gap | Broker config + topic/group metadata; publish/consume correlationId; crash/restart chứng minh dedupe. |
| Recommendation | Chốt C05, cấu hình manual offset commit và outbox order; lưu sample đầy đủ envelope. |

---

## PC8 — Kiểm tra mọi request đều phải đi qua Gateway

**Rubric:** Client request phải qua Gateway.

**Cần kiểm tra:**

- Service không public trực tiếp nếu thiết kế cấm.
- Direct access từ host bị chặn khi tiêu chí yêu cầu.
- Internal endpoint có cơ chế bảo vệ phù hợp.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS §14.1; §16.2.1/16.4; §17 PC8; E-002 micro §2/5.0/9.2/10.2; §11 PC8; E-003 phiếu PC8 |
| Finding | Client chỉ Gateway; không route internal; owner thiếu service token 401, wrong issuer 403; chỉ Gateway host port. |
| Gap | Direct host service connection fail; docker-network request không credential 401; /internal/** qua Gateway 404. |
| Recommendation | Kiểm cả port exposure và endpoint credential, không chỉ kiểm Gateway URL hoạt động. |

---

## PC9 — POSTMAN: Đăng ký tài khoản khách hàng

**Rubric:** Khách hàng chưa có tài khoản → đăng ký thành công → đăng nhập được.

**Cần kiểm tra:**

- API registration tồn tại.
- Validation dữ liệu đầu vào.
- Account/customer profile được tạo theo ownership của hệ thống.
- Không tạo duplicate trái rule.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-02/FR-02; §6.1/16.2.1; §17 PC9; E-002 micro §5.1/5.2/6.1/9.6; §11 PC9; E-003 phiếu PC9 |
| Finding | 201 sau Account/profile commit; operation durable/encrypted cho recover; uniqueness email/phone. |
| Gap | Postman register mới 201, login 200; duplicate 409; timeout profile/replay cùng operation không hai Account/profile. |
| Recommendation | Implement provisioning record và owner-local transactions; không transaction xuyên DB. |

---

## PC10 — POSTMAN: Đăng nhập khách hàng

**Rubric:** Khách hàng có tài khoản đang hoạt động → hệ thống cấp token.

**Cần kiểm tra:**

- Login API.
- Credential validation.
- Token được cấp đúng.
- Role/claims lấy từ nguồn server-side, không tin dữ liệu client khi rubric yêu cầu.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-03/FR-03; §16.2.1; §17 PC10; E-002 micro §5.1/9.2/9.4; §11 PC10; E-003 phiếu PC10 |
| Finding | Login email hoặc phone; claims role/sub/profileId/accountStatus/scope do server; RS256 verification và limited Driver scope. |
| Gap | Customer ACTIVE nhận JWT và gọi API own resource; credentials sai/SQLi không token. |
| Recommendation | Chốt issuer/audiences cùng middleware; token scope phải dựa state, không lấy role từ body. |

---

## PC11 — POSTMAN: Lấy thông tin khách hàng với mã số

**Rubric:** Sử dụng token để xem thông tin khách hàng.

**Cần kiểm tra:**

- Authorization theo ownership/role.
- Không lộ dữ liệu của user khác trái quyền.
- Endpoint và response khớp tài liệu.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-04/FR-04; BRULE-03; §16.3; §17 PC11; E-002 micro §5.2/9.4; §11 PC11; E-003 phiếu PC11 |
| Finding | Profile đọc tại Customer owner; xác minh profileId/sub mapping và owner; khác chủ 403. |
| Gap | C1 token xem C1 200; C1 xem C2 403; token thiếu/sửa 401; dữ liệu masked theo role. |
| Recommendation | Test ownership bằng 2 Customer; không chỉ kiểm một response 200. |

---

## PC12 — POSTMAN: Lấy thông tin tài xế với mã số

**Rubric:** Sử dụng token để xem thông tin tài xế.

**Cần kiểm tra:**

- Authorization.
- Scope dữ liệu Driver được phép xem.
- Sensitive fields được bảo vệ/masking nếu tài liệu yêu cầu.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-05/FR-05; §16.2/16.3; §17 PC12; E-002 micro §5.3/9.4; §11 PC12; E-003 phiếu PC12 |
| Finding | Driver owner/Admin và Customer public fields tách; CCCD/license/contact không lộ sai role. |
| Gap | Driver xem own; Customer đọc public snapshot; Driver khác 403; token thiếu 401; giấy tờ masked. |
| Recommendation | Dùng response serializer theo role; không trả raw DB row. |

---

## PC13 — POSTMAN: Liệt kê danh sách tài xế tại khu vực

**Rubric:** Driver xung quanh tọa độ trong bán kính 1 km; có `limit` và paging.

**Cần kiểm tra:**

- Radius/filter theo tọa độ.
- Driver status/availability rule.
- `limit`, `page`/paging.
- Kết quả có khoảng cách hoặc thông tin tương ứng theo thiết kế.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-09/FR-13; BRULE-07; §16.1/16.5; §17 PC13; E-002 micro §5.3/9.6; §11 PC13; E-003 phiếu PC13 |
| Finding | Đủ D1–D8 và trạng thái; default ONLINE/radius; lọc owner DB, Haversine, sort distance/id, total trước slicing; Redis không thay paging. |
| Gap | Nearby radius1km page/limit; boundary distance/empty page; OFFLINE/BUSY/PENDING bị loại default; total không lệch khi limit đổi. |
| Recommendation | Refresh location seed; test Redis stale/mất key và paging đầy đủ. |

---

## PC14 — POSTMAN: Liệt kê danh sách booking của Customer

**Rubric:** Booking liên quan đến Customer; có `limit` và paging.

**Cần kiểm tra:**

- Chỉ trả booking đúng customer.
- Pagination hoạt động.
- Sorting/filter theo thiết kế nếu có.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-12/FR-17; §16.1/16.5; §17 PC14; E-002 micro §5.4/9.4; §11 PC14; E-003 phiếu PC14 |
| Finding | B1–B5 đều cùng C1; requestedAt order và metadata; scope theo token. |
| Gap | C1 list total≥5, page/limit; C2 không nhận B1–B5; malformed paging400. |
| Recommendation | Seed đúng customerId; tie sort có id để paging ổn định. |

---

## PC15 — POSTMAN: Đặt xe

**Rubric:** Customer đặt xe → tạo booking → tìm driver gần điểm đón → gửi offer.

**Kết quả mong đợi:** Booking được tạo; customer thấy trạng thái đang tìm driver.

**Cần kiểm tra:**

- Booking state khởi tạo đúng.
- Dispatch/matching được kích hoạt.
- Offer được tạo đúng driver/rule.
- Flow giữa Booking ↔ Driver ↔ Trip/Notification nhất quán.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-10/11; FR-14/15/16; §6.5/16.2.1; §17 PC15; E-002 micro §5.4/6.5/9.6; §11 PC15; E-003 phiếu PC15 |
| Finding | SEARCHING201; dispatch gần nhất tuần tự; reserve tại Driver trước Offer/outbox; tariff chính thức ở Trip. |
| Gap | Fresh D1 ONLINE, POST Booking201 SEARCHING; GET Offer đúng driver và inbox offer. |
| Recommendation | Dùng BIKE/SEDAN có tariff; SUV giá chưa chốt C03 phải disabled/503, không tự báo giá. |

---

## PC16 — POSTMAN: Tài xế nhận chuyến

**Rubric:** Driver nhận notification → xem thông tin chuyến → accept.

**Kết quả mong đợi:** Ride/Trip được gán driver; customer nhận thông tin driver.

**Cần kiểm tra:**

- Offer lifecycle.
- Authorization: chỉ driver phù hợp mới accept.
- Assignment/Trip creation.
- Trạng thái Booking/Driver/Trip đồng bộ.

| Field | Audit |
|---|---|
| Document status | PARTIAL — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-13; FR-18/19/20; §6.6/16.2.1; §17 PC16; E-002 micro §5.3–5.5/6.6/9.6; §11 PC16; E-003 phiếu PC16 |
| Finding | Reserve/confirm/replay/recovery và late event đã đặc tả; CONFIRMED không tự release. TTL/lease parameter C04 còn cần chốt trước xây hoàn chỉnh. |
| Gap | Chốt G04; Offer→accept→Trip/snapshot; hai accept, expiry, mất response, cancel race, crash-confirm không hai Trip/không nhả guard sai. |
| Recommendation | Reproduce fault scenarios và constraint DB; không nghiệm thu chỉ happy path. |

---

## PC17 — POSTMAN: Cập nhật trạng thái chuyến

**Rubric:** Driver chuyển đến điểm đón → bắt đầu chuyến → cập nhật vị trí → hoàn thành.

**Kết quả mong đợi:** Trạng thái chuyến cập nhật đúng trình tự.

**Cần kiểm tra:**

- State machine.
- Không cho phép nhảy trạng thái trái rule.
- Chỉ actor có quyền thay đổi.
- Location/tracking được cập nhật nếu rubric yêu cầu.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-08/14; FR-12/21; §7/16.2; §17 PC17; E-002 micro §5.3/5.5/6.7/9.6; §11 PC17; E-003 phiếu PC17 |
| Finding | State sequence và quyền Driver assigned; location event namespace/version; DB+outbox mỗi transition. |
| Gap | ARRIVED→IN_PROGRESS→COMPLETED200; skip transition409; location ghi nhận trong Trip; khác Driver403. |
| Recommendation | Poll owner sau consume thay vì giả định synchronous Kafka; lưu recordedAt/version. |

---

## PC18 — POSTMAN: Hủy chuyến

**Rubric:** Customer chọn hủy → cung cấp lý do → xác nhận.

**Kết quả mong đợi:** Ride/Trip → `CANCELED`; các bên nhận notification.

**Cần kiểm tra:**

- Cancellation rules theo state.
- Reason validation.
- Booking/Trip/Driver state propagation.
- Notification/event được phát.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-15; FR-22/23; BRULE-15/16; §17 PC18; E-002 micro §6.8/9.6; §11 PC18; E-003 phiếu PC18 |
| Finding | Cancel reason/state; race accept/cancel được serialize; terminal event trả Driver/Booking và inbox. |
| Gap | Trip ASSIGNED/ARRIVED cancel200 CANCELED; missing reason400; IN_PROGRESS409; Customer/Driver inbox event. |
| Recommendation | Dùng Trip riêng để test cancel; không hủy Trip đã COMPLETED rồi kết luận. |

---

## PC19 — POSTMAN: Thanh toán online

**Rubric:** Chọn thanh toán online → thực hiện → callback → kiểm tra kết quả.

**Kết quả mong đợi:** Payment `COMPLETED`; chuyến được ghi nhận đã thanh toán.

**Cần kiểm tra:**

- Payment lifecycle.
- Provider integration/callback.
- Server-side amount validation nếu tài liệu yêu cầu.
- Callback authentication/integrity.
- Trip/payment synchronization.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-17/18; FR-26/28; §6.9.1/2; §16.2.1; §17 PC19; E-002 micro §5.6/6.9.1/2/9.6; §11 PC19; E-003 phiếu PC19 |
| Finding | BRULE-18 đã sửa: client không amount; provider callback HMAC/reference, Payment COMPLETED, Trip PAID qua event; mock contract chống double session. |
| Gap | Create/callback/GET Payment và Trip; wrong signature401/amount422; callback tới trước response, duplicate, stale attempt. |
| Recommendation | Dùng mock đã mô tả; provider thật cần C06/C07; không lấy mock làm bằng chứng tiền thật. |

---

## PC20 — POSTMAN: Đánh giá chuyến đi

**Rubric:** Customer đánh giá chuyến đi → chọn số sao → nhập nhận xét → gửi.

**Kết quả mong đợi:** Review được lưu và liên kết với chuyến đi.

**Cần kiểm tra:**

- Chỉ actor hợp lệ được review.
- Trip state phù hợp.
- Rating range validation.
- Comment validation/sanitization nếu có.
- One-review-per-trip rule nếu thiết kế có.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-16; FR-24/25; BRULE-17; §17 PC20; E-002 micro §5.5/6.9.3/9.6; §11 PC20; E-003 phiếu PC20 |
| Finding | Review Trip COMPLETED own Customer; unique tripId, stars integer1–5 và escaped comment; rating inbox dedupe. |
| Gap | Review201/GET200, repeat khác key trả 409, sai owner trả 403, stars ngoài biên trả 400; rating tăng một lần khi event replay. |
| Recommendation | Tách test review khỏi payment và giữ resource seed chưa Review. |

---

## PC21 — POSTMAN: Đăng ký tài xế

**Rubric:** OTP → xác thực → thông tin cá nhân/xe → gửi hồ sơ.

**Kết quả mong đợi:** Hồ sơ Driver tạo ở trạng thái chờ duyệt.

**Cần kiểm tra:**

- OTP flow.
- Registration token/session nếu có.
- Profile + vehicle ownership.
- Initial approval state.

| Field | Audit |
|---|---|
| Document status | PARTIAL — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-06; FR-06/07/08; §6.2/16.2.1; §17 PC21; E-002 micro §5.3/6.2/9.6; §11 PC21; E-003 phiếu PC21 |
| Finding | OTP, hồ sơ/xe và limited login/recovery mapping đầy đủ; thuật toán signing/key cụ thể registrationToken còn C02. |
| Gap | Chốt G02; request/verify/register201 PENDING_APPROVAL; login hạn chế xem application; code sai/hết hạn, token reuse operation mới bị chặn. |
| Recommendation | Cấu hình signing allowlist/key binding riêng; mock OTP không log secret trên production. |

---

## PC22 — POSTMAN: Duyệt hồ sơ tài xế

**Rubric:** Admin mở danh sách → xem chi tiết → approve/reject.

**Kết quả mong đợi:** Trạng thái hồ sơ cập nhật; Driver nhận kết quả.

**Cần kiểm tra:**

- Admin authorization.
- Approval state transition.
- Reject reason nếu yêu cầu.
- Notification/event sau quyết định.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-07; FR-09/10; §6.3/12.3.1; §17 PC22; E-002 micro §5.3/6.3/9.6; §11 PC22; E-003 phiếu PC22 |
| Finding | Admin P1 đúng actor; approve OFFLINE/reject REJECTED; Identity consume activation; Driver inbox đúng profileId. |
| Gap | A1 list/detail/approve hoặc reject D7; Driver nhận inbox; login mới ACTIVE rồi ONLINE; Customer approve trả 403. |
| Recommendation | Seed hồ sơ riêng cho approve/reject; kiểm Kafka trễ không nâng quyền sớm. |

---

## PC23 — POSTMAN: Bật/tắt trạng thái nhận chuyến

**Rubric:** Driver Online / Offline → hệ thống cập nhật.

**Cần kiểm tra:**

- Chỉ Driver được cập nhật trạng thái của chính mình.
- State persisted/visible ở matching.
- Transition rules không mâu thuẫn với Booking/Trip.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-08/FR-11; BRULE-06; §17 PC23; E-002 micro §5.3/9.6; §11 PC23; E-003 phiếu PC23 |
| Finding | Driver approved và token ACTIVE, vị trí mới; ONLINE/OFFLINE persist; có reservation hoặc BUSY không đổi availability trái rule. |
| Gap | Availability ONLINE↔OFFLINE200 và matching nhìn thấy; pending403; BUSY/reservation409. |
| Recommendation | Owner DB decide; không chỉ update Redis khiến state lệch DB. |

---

## PC24 — POSTMAN: Data encryption at rest

**Rubric:** Dữ liệu nhạy cảm lưu DB phải được mã hóa; plaintext không được đọc trực tiếp; có key management.

**Cần kiểm tra:**

- Password lưu dạng hash thích hợp, không phải plaintext.
- Dữ liệu nhạy cảm được mã hóa khi lưu nếu rubric/design yêu cầu.
- Key không hard-code vào source.
- Có cơ chế key identification/rotation hoặc key management phù hợp thiết kế.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS SEC-01/02; §16.4; §17 PC24; E-002 micro §9.2/9.6; §11 PC24; E-003 phiếu PC24 |
| Finding | Password Argon2id + pepper, contact/CCCD/license AES/keyId; workflow/response nhạy cảm được mã hóa, keys không trong DB/source. |
| Gap | Truy DB account/profile/OTP/idempotency thấy hash/ciphertext, không plaintext; key rotation sample đọc được dữ liệu cũ. |
| Recommendation | Scan cả log/outbox/technical payload; hashing password đáp ứng bảo vệ password, không đổi sang reversible encryption. |

---

## PC25 — POSTMAN: SQL injection attempt

**Rubric:** Input `' OR 1=1 --` không bypass authentication/query.

**Kết quả mong đợi:** Không login thành công; không lộ DB; HTTP 400/401.

**Cần kiểm tra:**

- Parameterized query/prepared statement/ORM binding.
- Validation input.
- Error response không leak SQL/DB detail.
- Có test thực tế hoặc code evidence.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-03/FR-03; SEC-03; §17 PC25; E-002 micro §9.2/9.4; §11 PC25; E-003 phiếu PC25 |
| Finding | Parameterized queries/allowlist input; SQLi email trả400/401 không token/DBdetail. |
| Gap | POST login đúng payload SQLi của phiếu; response400/401; code query binding và log redacted. |
| Recommendation | Không ghép chuỗi SQL; không coi regex validation là lớp phòng vệ duy nhất. |

---

## PC26 — POSTMAN: XSS input test

**Rubric:** Input `<script>alert('hack')</script>` không được execute; output được escape.

**Cần kiểm tra:**

- Input/output handling.
- Sanitization/escaping ở boundary thích hợp.
- Không render raw HTML/script từ user input nếu không được phép.
- Có evidence bằng request/response hoặc test.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-15/16; FR-23/24; SEC-04; §16.2.1; §17 PC26; E-002 micro §9.2/9.6; §11 PC26; E-003 phiếu PC26 |
| Finding | Escape một lần trên text write; JSON/nosniff, UI textContent; canonical request hash trước escape; HMAC callback raw body không bị sửa. |
| Gap | POST/GET script payload, assert encoded < > quotes, no executable render; replay không double escape. |
| Recommendation | Postman chứng minh escaped response; cần DOM/client test nếu tuyên bố browser không execute. |

---

## PC27 — POSTMAN: JWT tampering

**Rubric:** Sửa payload token hoặc `alg=none` không được chuyển thành quyền khác.

**Kết quả mong đợi:** Decode/verification fail; HTTP 401; không truy cập API.

**Cần kiểm tra:**

- Signature verification.
- Algorithm allow-list.
- Server không tin role/sub từ token giả mạo.
- Token expired/invalid xử lý đúng.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS SEC-05; §16.2.1/16.4; §17 PC27; E-002 micro §9.2; §11 PC27; E-003 phiếu PC27 |
| Finding | Signature RS256/algorithm allowlist/claims checked ở Gateway và owner; không chỉ decode. |
| Gap | Tamper sub/role hoặc alg=none, expired JWT →401; gọi API không thành công. |
| Recommendation | Test signature verification; message Token decode fail của phiếu hiểu là verify/reject, decode kỹ thuật vẫn có thể đọc payload. |

---

## PC28 — POSTMAN: Unauthorized API access

**Rubric:** Customer không có quyền gọi API Driver.

**Kết quả mong đợi:** HTTP 403 Forbidden; không trả dữ liệu.

**Cần kiểm tra:**

- RBAC/authorization matrix.
- Gateway enforcement và/hoặc service-side enforcement theo thiết kế.
- Không xảy ra privilege escalation qua route/service khác.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-08/FR-11; §16.3; §17 PC28; E-002 micro §5.0/9.2/9.4; §11 PC28; E-003 phiếu PC28 |
| Finding | Customer không gọi Driver mutation; public Driver read có JWT+serializer là quyền được cho phép riêng. |
| Gap | Customer PUT availability403 không data/side effect; forged X-Role/header bị bỏ; direct service failauth. |
| Recommendation | Test route write bị cấm; không lấy Customer public GET driver làm bằng chứng vi phạm. |

---

## PC29 — POSTMAN: Rate limit attack

**Rubric:** Spam API với lưu lượng rất lớn.

**Kết quả mong đợi:** HTTP 429; rate limit hoạt động; hệ thống không sập.

**Cần kiểm tra:**

- Rate limiter tồn tại và được đặt đúng boundary.
- Threshold/window/config được tài liệu hóa.
- Response `429`/`Retry-After` nếu thiết kế yêu cầu.
- Có test thực tế hoặc runtime evidence.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS SEC-07; §16.1/16.2.1; §17 PC29; E-002 micro §5.0/9.3/9.6; §11 PC29; E-003 phiếu PC29 |
| Finding | Threshold/window và Retry-After; Redis counter+expiry atomic; fail-closed503 khi rate backend hỏng. |
| Gap | Chạy lưu lượng mức phiếu, ghi RPS/duration/hardware, 429 Retry-After; health còn sống; new keys không tạo booking hàng loạt. |
| Recommendation | Không dùng một loạt 6 request nhỏ thay bằng chứng tải lớn; resource/RPS chưa được đo. |

---

## PC30 — POSTMAN: Replay attack (idempotency)

**Rubric:** Gửi lại request payment cũ không được xử lý transaction lần hai.

**Kết quả mong đợi:** Không double charge; trả response cũ.

**Cần kiểm tra:**

- `Idempotency-Key` hoặc cơ chế tương đương.
- Same key + same payload → same result.
- Same key + different payload → reject nếu thiết kế yêu cầu.
- Provider callback/event cũng không xử lý duplicate ngoài ý muốn.
- Có persistence cho idempotency state.

| Field | Audit |
|---|---|
| Document status | PASS — phạm vi đặc tả/thiết kế |
| Runtime status | PENDING — chưa chạy |
| Status | PARTIAL — tổng thể; có tài liệu, chưa có runtime |
| Evidence | E-001 SRS UC-17/18; FR-26/28; SEC-08; §16.2.1; §17 PC30; E-002 micro §9.1/9.6; §11 PC30; E-003 phiếu PC30 |
| Finding | Key+canonical payload persistence, exact cached response, stable provider_request_id, trip unique, callback dedupe; crash/TTL không tạo phiên mới. |
| Gap | Same key/body exact status/body, provider count1; differentbody422; concurrent/restart/replay saucallback; invalid amount input400. |
| Recommendation | Dùng payload hợp lệ {tripId,method}; old pending response là yêu cầu replay, GET để biết state mới. |

---

# 5. Bảng tổng hợp kết quả

| PC | Tiêu chí | Status tổng thể | Document | Runtime | Evidence | Finding / Gap | Priority |
|---:|---|---|---|---|---|---|---|
| 1 | Mô tả kiến trúc tổ chức source code | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC1 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 2 | Kiểm tra `.gitignore` và `.env` trên GitHub | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC2 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 3 | Mô tả nhiệm vụ Gateway trong hệ thống | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC3 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 4 | Mô tả IPC của các microservice | PARTIAL | PARTIAL | PENDING | E-001/E-002/E-003 PC4 | C02/C04; giao thức và thông số cần chốt | High |
| 5 | Compose hệ thống và liệt kê các container | PARTIAL | PARTIAL | PENDING | E-001/E-002/E-003 PC5 | C01/C05/C10; chưa có Compose/image/ports thật | High |
| 6 | POSTMAN: API health check | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC6 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 7 | Kiểm tra hệ thống Kafka / RabbitMQ | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC7 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 8 | Kiểm tra mọi request đều phải đi qua Gateway | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC8 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 9 | POSTMAN: Đăng ký tài khoản khách hàng | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC9 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 10 | POSTMAN: Đăng nhập khách hàng | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC10 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 11 | POSTMAN: Lấy thông tin khách hàng với mã số | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC11 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 12 | POSTMAN: Lấy thông tin tài xế với mã số | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC12 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 13 | POSTMAN: Liệt kê danh sách tài xế tại khu vực | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC13 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 14 | POSTMAN: Liệt kê danh sách booking của Customer | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC14 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 15 | POSTMAN: Đặt xe | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC15 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 16 | POSTMAN: Tài xế nhận chuyến | PARTIAL | PARTIAL | PENDING | E-001/E-002/E-003 PC16 | C04; lease/assignment stress test | High |
| 17 | POSTMAN: Cập nhật trạng thái chuyến | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC17 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 18 | POSTMAN: Hủy chuyến | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC18 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 19 | POSTMAN: Thanh toán online | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC19 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 20 | POSTMAN: Đánh giá chuyến đi | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC20 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 21 | POSTMAN: Đăng ký tài xế | PARTIAL | PARTIAL | PENDING | E-001/E-002/E-003 PC21 | C02; registration signing/key cần chốt | High |
| 22 | POSTMAN: Duyệt hồ sơ tài xế | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC22 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 23 | POSTMAN: Bật/tắt trạng thái nhận chuyến | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC23 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 24 | POSTMAN: Data encryption at rest | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC24 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 25 | POSTMAN: SQL injection attempt | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC25 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 26 | POSTMAN: XSS input test | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC26 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 27 | POSTMAN: JWT tampering | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC27 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 28 | POSTMAN: Unauthorized API access | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC28 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 29 | POSTMAN: Rate limit attack | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC29 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |
| 30 | POSTMAN: Replay attack (idempotency) | PARTIAL | PASS | PENDING | E-001/E-002/E-003 PC30 | Đủ mô tả; thiếu bằng chứng triển khai/thực hành | Medium |

Không quy đổi PASS tài liệu thành điểm. Tổng thể: 0 PASS, 30 PARTIAL, 0 FAIL, 0 PENDING; lớp runtime riêng: 30 PENDING.

---

# 6. Cross-document consistency audit

## SRS ↔ Microservice Design

| Check | Status | Evidence | Finding |
|---|---|---|---|
| Actor/role nhất quán | PASS (tài liệu) | SRS §3/9/16.2.1/16.3; micro §5/9.4/9.6 | Pending Driver login hạn chế; Admin approval P1; Operator/Executive P2 |
| Functional Requirements ↔ service ownership | PASS (tài liệu) | SRS §9/15; micro §5 | FR owner khớp; FR19 dùng reservation đã giữ |
| Business Process Model ↔ service flow | PASS (tài liệu) | SRS §6; micro §6/9.6 | Luồng nghiệp vụ cùng nhau; technical recovery bổ sung |
| Bounded Context ↔ Microservice boundary | PASS (tài liệu) | SRS §15.1; micro §1.6 | Mã BC giữ ổn định; 7 physical owner |
| API contract ↔ FR | PASS (tài liệu) | SRS §16.2; micro §9.4; E-005 | 38 public/10 internal contracts đối chiếu; DTO §16.2.1 |
| State machine ↔ workflow | PASS (tài liệu) | SRS §7/6; micro §3/6/9.6 | Enum domain không đổi; trạng thái technical phân biệt |
| Database ownership ↔ BC ownership | PASS (tài liệu) | SRS §13; micro §8; E-005 | Dictionary đồng bộ và không FK xuyên DB |
| Event ownership ↔ workflow | PASS (tài liệu) | SRS §12.1/12.3.1; micro §7/9.6; E-005 | 13 event giống nhau; recipient mapping và chống notify trùng |
| Security requirements ↔ implementation design | PASS (tài liệu) | SRS SEC-01–10/16.2.1; micro §9.2/9.6 | Key separation, scope, encrypted response, DB constraints; chưa là code |
| P1/P2 scope nhất quán | PASS (tài liệu) | SRS §5/14.2; micro §1.5/10.2 | Mọi backoffice-service (P2) ngoài P1 |

## Microservice Design ↔ Source Code

| Check | Status | Evidence | Finding |
|---|---|---|---|
| Service names match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Route/API names match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Port/network exposure match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Database names/ownership match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Internal REST endpoints match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Kafka topic/event names match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Redis usage match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Auth/RBAC behavior match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Idempotency behavior match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |
| Security controls match | PENDING | Chưa có source/runtime | Phải kiểm với commit/Compose thực tế; không tự kế thừa repo/bản cũ |

---

# 7. Audit findings

## Critical

Không có lỗi kiến trúc Critical đã chứng minh còn tồn tại ở bản tài liệu v3.1. Điều này không phải chứng minh runtime an toàn: chưa có source để phát hiện lỗi triển khai. Các lỗi High về ownership/giao dịch bên dưới đã sửa **tài liệu**, chưa chạy fault test.

## High

| ID | Phát hiện ở v3.0 | Sửa trong v3.1 | Trạng thái |
|---|---|---|---|
| F01 | BRULE-18 cho client amount trong khi API cấm | SRS BRULE-18: client amount400; callback server amount đối chiếu | FIXED_DOCUMENT; runtime PENDING |
| F02 | Account chưa ACTIVE không login, nhưng FR08 phải xem hồ sơ chờ duyệt | SRS §16.2.1/micro §9.6: limited JWT/app read/inbox; token ACTIVE sau duyệt | FIXED_DOCUMENT; runtime PENDING |
| F03 | Notification so sub Account với customerId/driverId | JWT profileId/role và recipient tuple; schema fields đồng bộ | FIXED_DOCUMENT; runtime PENDING |
| F04 | Offer có reservation_id nhưng reserve chỉ lúc accept; có thể hai Offer cho cùng Driver | Reserve trước Offer, DB constraint và confirm idempotent | FIXED_DOCUMENT; runtime PENDING |
| F05 | TTL reservation có thể giải phóng trong khi Trip commit/mất response | HELD/CONFIRMED tách; persistent command/replay/abort fencing; không auto-expiry CONFIRMED | FIXED_DOCUMENT; C04 OPEN_GATE |
| F06 | Chưa diễn tả đầy đủ provider create crash + replay | provider_request_id bền vững; no retry nếu PENDING/uncertain; callback lock/dedupe | FIXED_DOCUMENT; C06/C07 runtime PENDING |
| G02 | Thuật toán/key config registrationToken chưa chốt | Startup validate; scope/binding contract đã rõ | OPEN_GATE, PC4/21 |
| G04 | HELD lease/command retry parameters chưa chốt và chưa stress test | Recovery spec có ở micro §9.6; chưa tự đặt số | OPEN_GATE, PC4/16 |


## Medium

| ID | Khoảng trống | Xử lý | Trạng thái |
|---|---|---|---|
| F07 | Schema thiếu profileId/activeTrip/version/state/response encryption | Dictionary bổ sung field cần triển khai; local FK/unique rõ | FIXED_DOCUMENT; runtime PENDING |
| F08 | SQL và Redis bị hiểu là transaction nguyên tử chung | DB owner quyết định; cache update sau commit/rebuild | FIXED_DOCUMENT; runtime PENDING |
| F09 | GEO COUNT/paging có thể làm sai total/stale member | Candidate DB filtering/sort/count/slice; stale job | FIXED_DOCUMENT; runtime PENDING |
| F10 | Version khác owner/event bị so chung, terminal event đến trước assigned | namespace aggregate, giữ gap, terminal marker theo tripId | FIXED_DOCUMENT; C05 runtime PENDING |
| F11 | Response cache không secret nhưng paymentUrl/reservation token cần replay | response encrypted/kid; login no cache; HMAC request có password | FIXED_DOCUMENT; runtime PENDING |
| F12 | Health UC mơ hồ khi dependency DOWN; DTO/error chưa rõ | /health process vs /ready; DTO và error envelope rõ | FIXED_DOCUMENT; runtime PENDING |
| G01 | Chưa Compose thực tế/image/ports/stack/broker init | Registry thiết kế; validate/init/health/volume/network gate | OPEN_GATE, PC5 |
| G03 | SUV tariff không có nguồn; estimate seed sharing | Không bịa giá; seed type disabled tới khi chốt, BIKE/SEDAN dùng chung version | OPEN_GATE; không đủ full seed prompt nếu SUV chưa được cấp giá |
| G05–G07 | Broker config/provider execution/30 evidence chưa có | Kế hoạch cần thực thi theo micro §9.6 và audit từng PC | OPEN_RUNTIME |


## Low

Đã kiểm tra anchor/bảng/fence và các catalog giống nhau. Sửa JOSE kid thuộc header; làm rõ “token decode fail” là verify/reject và các payload minh họa của phiếu không cho phép bypass owner/amount. C09 về chức năng backoffice-service (P2) không chặn P1, nhưng cần đặc tả riêng nếu triển khai sau.

---

# 8. Remediation plan

| Priority | PC / Finding | Root cause | Required change | Owner | Status |
|---|---|---|---|---|---|
| High | F01–F06 | Các rule/giao dịch v3.0 còn mâu thuẫn hoặc thiếu recovery | Đã sửa SRS v3.1/micro v3.1; implement và fault test | Backend owners | FIXED_DOCUMENT / PENDING_RUNTIME |
| High | PC4/21 G02 | C02 chưa có signing/key config registration | Chốt thuật toán allowlist/key/binding rồi test expired/reuse/scope | Identity + Driver / chủ dự án | OPEN_GATE |
| High | PC16 G04 | C04 chưa lease parameters và recovery thực | Chốt thông số; test concurrency/timeout/expiry/confirm/abort | Booking + Driver + Trip | OPEN_GATE |
| Medium | PC5 G01 | Chưa source/Compose/image/ports/init | Dựng đúng registry, ready/dependency/listener/volume | DevOps / chủ dự án | OPEN_GATE |
| Medium | G03/C03 | Không có SUV tariff ở nguồn | Cấp tariff được chốt; load cùng version cho estimate và Trip; chưa có thì không tự tính | Trip + Booking / chủ dự án | OPEN_GATE |
| Medium | PC7/16/18/19/22 G05 | Chưa runtime broker/outbox/inbox | Manual offset, ordering/gap/DLQ/crash test | Kafka + owner consumers | PENDING_RUNTIME |
| Medium | PC19/30 G06 | Chưa chạy adapter provider | Chạy mock signed callback và provider count; contract thật xác nhận nếu dùng | Payment | PENDING_RUNTIME |
| Medium | PC1–30 G07 | Thiếu source/run evidence | Attach commit/config/Postman/log/DB/load; audit lại từng PC | Đội phát triển | PENDING_RUNTIME |

---

### 8.1 Phương án đề xuất để đóng gate

Bảng này là đề xuất cho backend tương lai, chưa được xem là quyết định nguồn đã chốt và không khẳng định code hiện hữu đang dùng.

| Gate | Phương án đề xuất cụ thể | Điều cần xác nhận |
|---|---|---|
| G02/C02 | Dùng RS256 cho registrationToken với keypair riêng của Driver; Identity giữ public key tương ứng. Phương án thứ hai là HS256 với secret riêng Driver→Identity. Giữ TTL từ SRS §16.1 và phone binding HMAC riêng | Chọn một thuật toán/key configuration; tuyệt đối không dùng user-access private key hoặc internal JWT secret cho token đăng ký |
| G04/C04 | HELD.expiresAt tính bằng OFFER_TTL đã có ở SRS §16.1; Offer dùng cùng expiresAt trả từ Driver. Confirm trước hạn; CONFIRMED không expiry theo timer. Recovery dùng commandKey và terminal events/ABORTED như micro §9.6 | Chốt cách tích hợp deadline/worker retry và xác nhận fault tests; không tự coi expiration là kết quả Trip thất bại |
| G01/C01/C10 | Giữ profile registry ở micro §10.2; chọn image tags/stack, app ports nội bộ qua env, broker metadata mode và init Mongo replica-set. Mọi DB user/service chỉ truy owner DB | Ports/images phải có giá trị thực trước docker compose up; registry sửa theo triển khai thực nếu dùng DB container riêng |
| G03/C03 | Giữ BIKE/SEDAN tariff đã có nguồn, seed cùng tariffVersion cho estimate và Trip. SUV giữ mã loại xe nhưng disabled đến khi được cấp giá | Chủ dự án cấp SUV tariff; không sao chép cước loại xe khác rồi gọi là giá đã chốt |
| G06/C06/C07 | Nghiệm thu P1 bằng mock Payment/Map/SMS với reference dedupe, signed callback và counter số phiên; provider thật đi qua cùng adapter contract | Xác nhận hình thức mock với giảng viên; provider thật cần terminal-failure/idempotency/query guarantees |

Các phương án này giúp việc chốt có thể thực hiện trực tiếp, nhưng status audit vẫn giữ PARTIAL/PENDING tới khi có quyết định và bằng chứng tương ứng.

---

# 9. Final audit conclusion

**Overall:** `PARTIAL` — audit tài liệu; chưa nghiệm thu backend

**Passed:** `0 / 30` (tổng thể)

**Partial:** `30 / 30` (có tài liệu, thiếu runtime)

**Failed:** `0 / 30` (chưa có bằng chứng thất bại runtime)

**Pending:** `0 / 30` (status tổng thể); lớp runtime riêng `30 / 30 PENDING`

### Conclusion

SRS/micro v3.1 phủ đủ yêu cầu của 30 tiêu chí và đã sửa các mâu thuẫn được phát hiện. Kiến trúc có cơ sở triển khai: ownership, DB constraint, token/recipient, event, reserve/recovery và provider idempotency đã được mô tả cụ thể. Tài liệu sẵn sàng 26 tiêu chí; PC4, PC5, PC16, PC21 còn gate thiết kế/cấu hình. Có thể bắt đầu foundation; chưa nên coi assignment/registration/Compose hoàn chỉnh khi gate còn mở.

Chưa thể kết luận “đạt 30 tiêu chí thực hành” hoặc “backend đã chạy được”. Không có source commit, Compose, DB/log hay execution để chứng minh. Muốn PASS 30/30: đóng G01–G07, triển khai theo v3.1, thu evidence từng PC và audit lại đúng commit đó. SUV chưa có cước và provider thật chưa được chọn phải được xử lý rõ, không tự mặc định.

Không có yêu cầu xây backend trong lần này; việc hoàn thành audit và sửa tài liệu không thay thế triển khai.

---

# 10. Evidence index

| ID | Evidence type | Location / Link | Supports PC | Notes |
|---|---|---|---|---|
| E-001 | Tài liệu | srs.md | PC1–30 | v3.1, nghiệp vụ/constraints/DTO; SHA256 `69286d463cc25375dc1cf5d09f953e214a2fa1d498e010afdae1daafde1cb94b` |
| E-002 | Tài liệu | microservice_design.md | PC1–30 | v3.1, contracts/recovery/gates; SHA256 `7a04b8b8b0a8e66b2640ded380bff0c837187b9a672fd08ca263ed0e2f610df0` |
| E-003 | Rubric | upload/phieucham.md | PC1–30 | Nguồn tiêu chí gốc; SHA256 `1175466aa62cddd51f99df43c7c6d84cf75e9acbf147a9e6bdc7a186aa37f717` |
| E-004 | Template | upload/audit_30_tieu_chi_template.md | PC1–30 | Giữ cấu trúc mục 1–11, không kế thừa status; SHA256 `f0ea117cd52539993ae63280de59d5e7a16689edc48ebedfa58e42fa9bc2fe3c` |
| E-005 | Kiểm tra tự động tài liệu | micro §12.4; lần rà v3.1 | PC3/4/5/7/8 và consistency | 30/30 rows, 38 API, 10 internal contracts, 13 events, data dictionary, anchors/table/fence, DAG và registry đã kiểm; không test backend |
| E-006 | Đối chiếu baseline trước sửa | findings F01–F12; SRS §19/micro §12.5 | PC4/9/10/13/16/19/21/24/30 | Findings là lỗi tài liệu v3.0; đã sửa v3.1, không khẳng định runtime đã sửa |
| E-007 | Tài liệu kỹ thuật chính thức | micro §9.6 “Cơ sở kỹ thuật” | PC4/7/13/16 | PostgreSQL locks/index, Kafka semantics, Mongo transactions, Redis GEO; hỗ trợ thiết kế, không runtime evidence |

---

# 11. Audit log

| Date/Time | Auditor | Change / Action | Result |
|---|---|---|---|
| 01/10/2026 (Asia/Ho_Chi_Minh) | Codex | Đọc template/phiếu/SRS/micro; sửa v3.1; đối chiếu catalog và lập audit | 30/30 coverage; 26 PASS tài liệu + 4 PARTIAL; toàn bộ runtime PENDING |

---

## Reference

- Rubric: `phieucham.md` — 30 tiêu chí PC1–PC30.
- Nguồn cơ sở kỹ thuật: PostgreSQL, Kafka, MongoDB, Redis documentation đã liệt kê trong micro §9.6.
- Khi audit một phiên bản tài liệu mới, **SRS và Microservice Design mới là nguồn đối chiếu**; không tự động kế thừa kết luận của audit cũ.
