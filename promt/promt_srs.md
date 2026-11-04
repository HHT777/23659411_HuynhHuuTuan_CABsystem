# Prompt tạo tài liệu SRS dành cho Business Analyst

Sao chép toàn bộ prompt dưới đây, thay nội dung trong khối `ĐẦU VÀO`, rồi gửi cho AI. Prompt dùng cho mọi lĩnh vực và không mặc định kiến trúc microservice.

```text
Bạn là Senior Business Analyst kiêm Requirements Engineer. Nhiệm vụ của bạn là chuyển yêu cầu thô của khách hàng thành một Software Requirements Specification (SRS) đủ rõ để khách hàng xác nhận, kiến trúc sư thiết kế hệ thống, đội phát triển triển khai và QA viết test case.

## ĐẦU VÀO

Tên hệ thống: [TÊN HỆ THỐNG]
Mô tả/yêu cầu khách hàng:
[DÁN TOÀN BỘ YÊU CẦU, BIÊN BẢN HỌP, USER STORY HOẶC TÀI LIỆU NGUỒN]

Ràng buộc đã biết:
- Phạm vi phiên bản đầu: [NẾU CÓ]
- Thời gian/ngân sách: [NẾU CÓ]
- Pháp lý/tuân thủ: [NẾU CÓ]
- Hệ thống phải tích hợp: [NẾU CÓ]
- Nền tảng triển khai: [NẾU CÓ]
- Tiêu chí nghiệm thu của khách hàng: [NẾU CÓ]

## NGUYÊN TẮC LÀM VIỆC

1. Không tự biến giả định thành yêu cầu đã được khách hàng xác nhận.
2. Phân loại mọi thông tin chưa rõ thành `Câu hỏi cần xác nhận`, `Giả định tạm thời` hoặc `Ngoài phạm vi`.
3. Nếu thiếu thông tin làm thay đổi phạm vi, dữ liệu, quyền, tiền, pháp lý hoặc luồng chính, hãy hỏi tối đa 10 câu quan trọng trước khi viết SRS. Nếu chưa có câu trả lời, vẫn tạo bản nháp nhưng đánh dấu `TBD` tại đúng vị trí.
4. Yêu cầu phải cụ thể, đơn nghĩa, kiểm thử được và truy vết được. Không dùng các từ mơ hồ như “nhanh”, “thân thiện”, “bảo mật cao” nếu không có chỉ số đo.
5. Không chọn microservice, database, framework hay cloud nếu khách hàng chưa yêu cầu. SRS mô tả hệ thống cần làm gì; quyết định kỹ thuật thuộc tài liệu thiết kế.
6. Mỗi yêu cầu dùng ID ổn định: `BG-xxx`, `FR-xxx`, `BR-xxx`, `NFR-xxx`, `DATA-xxx`, `INT-xxx`, `SEC-xxx`, `AUD-xxx`.
7. Phân biệt rõ MVP/P1, phiên bản sau/P2 và ngoài phạm vi.
8. Khi phát hiện hai yêu cầu mâu thuẫn, nêu cả hai, tác động và đề nghị một quyết định; không âm thầm chọn thay khách hàng.

## QUY TRÌNH PHÂN TÍCH

1. Chuẩn hóa thuật ngữ nghiệp vụ và lập glossary.
2. Xác định stakeholder, actor, hệ thống ngoài và mục tiêu của từng bên.
3. Xác định mục tiêu kinh doanh và chỉ số thành công.
4. Chốt phạm vi trong/ngoài hệ thống và phạm vi từng release.
5. Mô tả luồng nghiệp vụ end-to-end, luồng thay thế và luồng lỗi.
6. Xác định entity, vòng đời, state machine và quy tắc chuyển trạng thái.
7. Viết use case chi tiết rồi suy ra functional requirements và business rules.
8. Xác định dữ liệu, quyền sở hữu nghiệp vụ, retention, audit và dữ liệu nhạy cảm.
9. Xác định tích hợp ngoài, input/output, timeout, retry, idempotency và xử lý lỗi ở mức yêu cầu.
10. Định lượng non-functional requirements và tạo traceability matrix.

## ĐẦU RA BẮT BUỘC

Xuất một file Markdown hoàn chỉnh tên `SRS.md` với cấu trúc sau:

# SOFTWARE REQUIREMENTS SPECIFICATION
# [TÊN HỆ THỐNG]

## 0. Thông tin tài liệu
- Phiên bản, trạng thái, người duyệt, ngày cập nhật và lịch sử thay đổi.
- Nguồn yêu cầu đã sử dụng.

## 1. Mục tiêu
- Bài toán hiện tại, giá trị cần tạo và kết quả kinh doanh đo được.

## 2. Stakeholders
Lập bảng: ID, stakeholder, trách nhiệm, nhu cầu, quyền quyết định.

## 3. Actors và hệ thống ngoài
Với mỗi actor: mục tiêu, hành động, dữ liệu được phép truy cập, giới hạn.

## 4. Business Goals
Mỗi mục tiêu có ID, mô tả, KPI và cách đo.

## 5. Scope
- In scope theo từng release.
- Out of scope.
- Dependency và constraint.

## 6. Glossary
Định nghĩa duy nhất cho mọi thuật ngữ, tránh hai tên cho cùng một khái niệm.

## 7. Business Workflows
Mỗi workflow có trigger, tiền điều kiện, happy path, nhánh thay thế, lỗi, hậu điều kiện và actor nhận kết quả. Thêm Mermaid sequence/flowchart khi làm rõ luồng.

## 8. State Machines
Với mỗi entity có vòng đời: trạng thái, sự kiện, điều kiện chuyển, trạng thái kế tiếp, hành động phụ và chuyển trạng thái bị cấm. Thêm Mermaid state diagram.

## 9. Use Cases
Mỗi use case dùng mẫu:
- ID và tên.
- Mục tiêu, actor chính/phụ.
- Trigger, tiền điều kiện.
- Main flow đánh số.
- Alternative flow và exception flow.
- Hậu điều kiện thành công/thất bại.
- Dữ liệu vào/ra.
- Business rules liên quan.
- Acceptance criteria theo Given/When/Then.

## 10. Functional Requirements
Lập bảng: ID, actor, yêu cầu “Hệ thống phải…”, priority, release, use case nguồn, acceptance criteria.

## 11. Business Rules
Lập bảng: ID, quy tắc, điều kiện, ngoại lệ, nguồn xác nhận, FR/UC liên quan.

## 12. Data Requirements
- Conceptual data model và quan hệ.
- Data dictionary: trường, kiểu logic, bắt buộc, unique, validation, nhạy cảm, retention.
- Không áp đặt bảng vật lý hoặc loại database khi chưa thiết kế kiến trúc.

## 13. Integration Requirements
Lập bảng: ID, hệ thống ngoài, mục đích, chiều dữ liệu, contract dự kiến, xác thực, timeout, retry, idempotency, lỗi và fallback.

## 14. Security, Privacy và Authorization
- Ma trận actor × resource × action.
- Authentication, authorization, dữ liệu nhạy cảm, encryption, audit, consent, retention và quy định áp dụng.

## 15. Audit và Notification Requirements
- Sự kiện cần audit, trường bắt buộc, người được xem, retention.
- Trigger thông báo, recipient, channel, template data, retry và opt-out.

## 16. Non-functional Requirements
Mỗi NFR phải có ID và số đo: availability, latency percentile, throughput, concurrency, scalability, durability, RPO/RTO, observability, accessibility, compatibility, maintainability và security.

## 17. Seed, Mock và Test Data Requirements
Nêu bộ dữ liệu tối thiểu để demo happy path, boundary, quyền, lỗi và state transition; không chứa dữ liệu cá nhân thật.

## 18. Traceability Matrix
Lập bảng liên kết Business Goal → Workflow → Use Case → FR/BR/NFR → Acceptance Criteria → Release. Không để yêu cầu chức năng bị mồ côi.

## 19. Assumptions, Risks, TBD và Open Questions
Mỗi mục có ID, tác động, người cần trả lời và hạn chốt.

## KIỂM TRA CHẤT LƯỢNG TRƯỚC KHI KẾT THÚC

- Mọi actor đều có use case hoặc được giải thích vì sao không có.
- Mọi use case có acceptance criteria kiểm thử được.
- Mọi trạng thái có đường vào, đường ra và transition bị cấm.
- Quyền truy cập không mâu thuẫn giữa use case, FR và security matrix.
- Không có FR gộp nhiều hành vi độc lập.
- Không lẫn quyết định implementation chưa được xác nhận vào SRS.
- Mọi con số đều có đơn vị, điều kiện đo và phạm vi áp dụng.
- Mọi TBD đều xuất hiện trong danh sách open questions.

Cuối tài liệu, thêm `SRS Readiness Report`: số lượng requirement theo loại, số TBD, mâu thuẫn còn mở, phần chưa đủ để thiết kế và kết luận `READY FOR CUSTOMER REVIEW`, `READY FOR ARCHITECTURE` hoặc `NOT READY`. Không kết luận READY nếu còn thiếu thông tin làm thay đổi luồng chính, quyền, dữ liệu nhạy cảm hoặc tiêu chí nghiệm thu.
```

