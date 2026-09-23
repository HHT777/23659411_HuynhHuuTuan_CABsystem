# 11 — Xác định Non-Functional Requirement (NFR)

**Hệ thống:** CAB System (backend service/API đặt xe trực tuyến của ABC)

Dựa trên kết quả đã xác định từ:
- `SRS.md` — B4 Scope (In-Scope/Out-of-Scope/Ưu tiên)
- `SRS.md` — B7 Functional Requirement (FR01–FR62)
- `SRS.md` — B8 Business Rules (BR_01–BR_22) & Exception Rules (EX01–EX09)

---

# I. ĐẦU VÀO VÀ TRUY XUẤT

## 1. Nguồn chính

- FR (FR01–FR62) và các bài toán API cần đáp ứng (mục 7.13).
- Rule (BR_01–BR_22) và Exception (EX01–EX09) có ảnh hưởng đến chất lượng hoặc vận hành.
- Scope: backend service/API, minimal viable backend trong 7 tuần, ưu tiên P0 core.

## 2. Nguồn đối chiếu

- BR (BR01–BR29) tại B5.
- BP (BP-01 → BP-07) tại B6.
- Stakeholder tại B2.

## 3. Chuỗi truy xuất

**Nguồn → NEED → STK → SCOPE → BR → BP → FR → FR con/Rule/Exception → NFR**

NFR suy ra từ yêu cầu chất lượng cần thiết để bảo đảm FR/Rule được ghi **[Suy ra]** và nêu cơ sở. NFR thiếu cơ sở định lượng được ghi **[Cần làm rõ]**; không tự đặt thông số thiếu căn cứ.---

# II. MỤC TIÊU

Xác định các yêu cầu liên quan đến: hiệu năng, bảo mật, khả năng sử dụng, độ tin cậy, khả năng bảo trì, khả năng tương thích, sao lưu & phục hồi (nếu thực sự cần thiết).

Mỗi NFR phải gắn với nhu cầu chất lượng hoặc ràng buộc có cơ sở, cụ thể ở mức kiểm tra/đánh giá được, phù hợp phạm vi đồ án nhỏ (7 tuần), và không biến thành chức năng mới.

---

# III. PHÂN BIỆT FR VÀ NFR

- **FR** mô tả hệ thống phải *làm gì* (ví dụ FR03 — API xác thực thông tin đăng nhập).
- **NFR** mô tả hệ thống phải *làm việc đó với chất lượng/ràng buộc như thế nào* (ví dụ NFR — việc xác thực phải từ chối đúng với thông tin sai mà không lộ dữ liệu nhạy cảm).

**Không đưa vào NFR:** chức năng mới, tên bảng/cột, endpoint/HTTP method, framework/thư viện, kiến trúc triển khai, acceptance criteria hoàn chỉnh.

---

# IV. NGUYÊN TẮC (tóm tắt áp dụng)

1. Chỉ xác định NFR thực sự cần cho hệ thống.
2. Không thêm yêu cầu chất lượng theo thông lệ khi không có cơ sở.
3. Không biến FR thành NFR.
4. Mỗi NFR có tiêu chí kiểm tra/đánh giá.
5. Không đặt con số khi nguồn chưa cung cấp → dùng mô tả định tính hoặc **[Cần làm rõ]**.
6. Ưu tiên NFR mức cơ bản, cốt lõi.
7. NFR suy ra ghi **[Suy ra]**; vượt phạm vi ghi **[Có khả năng vượt phạm vi đồ án — cần xác nhận]**; ngoài phạm vi ghi **[Ngoài phạm vi]**.
8. Giữ nguyên FR/BR/BP/Rule/Exception ID.
9. Không thiết kế giải pháp kỹ thuật.

---# VII. DANH SÁCH NFR

| NFR ID | Nhóm | Yêu cầu phi chức năng | FR/Rule/Exception liên quan | Tiêu chí kiểm tra | Mức độ | Nguồn | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-01 | Security | Hệ thống phải từ chối truy cập chức năng yêu cầu tài khoản đối với người dùng chưa xác thực. | FR01/FR03/FR59/BR_01 | Người dùng không có phiên xác thực hợp lệ không thể gọi chức năng yêu cầu tài khoản. | Cao | BR23, BR_01 | Đã xác nhận |
| NFR-02 | Security | Hệ thống phải từ chối thao tác quản trị nhạy cảm khi người dùng không có quyền phù hợp và không làm thay đổi dữ liệu nghiệp vụ. | FR54/FR60/EX06/EX08/BR_18 | Thao tác không đúng quyền bị từ chối và không ghi thay đổi dữ liệu. | Cao | BR21, EX06 | Đã xác nhận |
| NFR-03 | Security | Hệ thống không được lưu trực tiếp dữ liệu thanh toán nhạy cảm do Payment Provider quản lý. | FR34/FR35/FR62/BR_12 | Kiểm tra hệ thống không lưu trường thanh toán nhạy cảm; giao dịch điện tử đi qua Payment Provider. | Cao | BR12, BR24 | Đã xác nhận |
| NFR-04 | Security | Hệ thống phải bảo vệ thông tin cá nhân, phương tiện, vị trí và giao dịch; vị trí tài xế chỉ được dùng cho nghiệp vụ được phân quyền. | FR20/FR24/BR_09/BR_20/EX08 | Dữ liệu vị trí/giao dịch chỉ truy cập được bởi nghiệp vụ có quyền. | Cao | BR24, BR_09 | Chờ OI10 (một phần) |
| NFR-05 | Security | Hệ thống phải ghi lại người thực hiện và thời điểm của các thao tác quan trọng. | FR61/BR_19 | Thao tác quan trọng có bản ghi audit gồm người và thời điểm. | Cao | BR25, BR_19 | Đã xác nhận |
| NFR-06 | Reliability | Hệ thống phải đảm bảo chuyến chỉ chuyển trạng thái theo thứ tự hợp lệ; cập nhật trạng thái không hợp lệ bị từ chối và giữ nguyên trạng thái hiện tại. | FR21–FR24/FR27/EX02/EX09/BR_07/BR_08 | Cập nhật trạng thái sai thứ tự bị từ chối, trạng thái không đổi. | Cao | BR08, BR_07, EX09 | Đã xác nhận |
| NFR-07 | Reliability | Hệ thống phải đảm bảo không mất dữ liệu trong các thao tác nghiệp vụ thông thường (tạo yêu cầu, kết quả thanh toán, đánh giá). | FR08/FR09/FR30/FR35/FR47 | Sau thao tác thành công, dữ liệu được lưu chính xác và truy vấn lại được. | Cao | BR14, BR_19 | Đã xác nhận |
| NFR-08 | Reliability | Hệ thống phải hạn chế ảnh hưởng khi thành phần thanh toán/thông báo gặp lỗi, không làm hỏng trạng thái chuyến chính. | FR34–FR37/FR38–FR43/BR_13/BR_21/EX05 | Lỗi thanh toán/thông báo được ghi nhận và xử lý theo policy, không làm sai trạng thái chuyến. | Cao | BR26, BR_13 | Đã xác nhận |
| NFR-09 | Performance | Các chức năng nghiệp vụ cốt lõi (đặt xe, matching, cập nhật trạng thái, thanh toán) phải phản hồi trong giới hạn phù hợp đồ án. | FR07–FR20/FR21–FR27/FR32–FR37 | Thời gian phản hồi không gây gián đoạn nghiệp vụ ở quy mô đồ án. | Trung bình | BR03, BG10 | Cần làm rõ (chưa có ngưỡng) |
| NFR-10 | Usability | Thông báo lỗi và trạng thái nghiệp vụ phải rõ ràng để khách hàng/tài xế nhận biết kết quả. | FR10/FR17/FR25/FR36/EX01/EX05/EX06 | Người dùng nhận được thông báo trạng thái/lỗi dễ hiểu ở các mốc chính. | Trung bình | BR06, BR13, EX01 | Đã xác nhận |
| NFR-11 | Maintainability | Hệ thống phải có cấu trúc đủ rõ để tiếp tục mở rộng chức năng với ảnh hưởng hạn chế đến chức năng đang hoạt động. | FR29/FR37/BR_28/BR_29 | Bổ sung loại dịch vụ/phương thức thanh toán/kênh thông báo không phá vỡ chức năng hiện có. | Trung bình | BR28, BR29 | Đã xác nhận |
| NFR-12 | Compatibility | Hệ thống phải hoạt động ổn định trên môi trường triển khai của đồ án và tương thích với Payment/Notification Provider bên ngoài. | FR34/FR35/FR38–FR43 | Tích hợp với provider hoạt động đúng trên môi trường triển khai. | Trung bình | BR12, BR14, BR15 | Đã xác nhận |
| NFR-13 | Backup & Recovery | Dữ liệu nghiệp vụ cốt lõi phải có khả năng khôi phục trong giới hạn phù hợp đồ án nhỏ. | FR09/FR30/FR35/FR47/BR_22 | Có cơ chế sao lưu/phục hồi cơ bản cho dữ liệu chính. | Thấp | BR24, BR_22 | Cần làm rõ |

---# VIII. CẤU TRÚC CHI TIẾT CỦA CÁC NFR QUAN TRỌNG

---

## NFR-01 — Kiểm soát truy cập chức năng yêu cầu tài khoản

### 1. Nhóm
Security

### 2. Nội dung yêu cầu
Hệ thống phải yêu cầu xác thực và từ chối truy cập đối với người dùng chưa xác thực khi gọi các chức năng yêu cầu tài khoản.

### 3. Phạm vi áp dụng
- FR/FR con: FR01, FR03, FR59
- BP/Step: BP-01 (đăng ký/đăng nhập), tất cả BP liên quan
- Rule/Exception: BR_01, EX08

### 4. Tiêu chí kiểm tra
- Người dùng không có phiên xác thực hợp lệ không thể thực hiện chức năng yêu cầu tài khoản.

### 5. Mức độ
Cao

### 6. Nguồn và trạng thái
| Thành phần | Giá trị |
| --- | --- |
| Nguồn | BR23, BR_01 |
| BR | BR01, BR23 |
| FR/FR con | FR59 |
| Rule/Exception | BR_01/EX08 |
| Trạng thái | Đã xác nhận |

---

## NFR-02 — Kiểm soát thao tác quản trị nhạy cảm

### 1. Nhóm
Security

### 2. Nội dung yêu cầu
Hệ thống phải kiểm tra quyền trước khi thực hiện thao tác quản trị nhạy cảm; nếu không có quyền thì từ chối và không làm thay đổi dữ liệu nghiệp vụ.

### 3. Phạm vi áp dụng
- FR/FR con: FR54, FR60
- BP/Step: BP-06 (vận hành & xử lý sự cố)
- Rule/Exception: BR_18, EX06, EX08

### 4. Tiêu chí kiểm tra
- Thao tác không đúng quyền bị từ chối và không ghi thay đổi dữ liệu.

### 5. Mức độ
Cao

### 6. Nguồn và trạng thái
| Thành phần | Giá trị |
| --- | --- |
| Nguồn | BR21, EX06 |
| BR | BR21, BR23 |
| FR/FR con | FR54/FR60 |
| Rule/Exception | BR_18/EX06/EX08 |
| Trạng thái | Đã xác nhận (chi tiết role chờ OI08) |

---

## NFR-03 — Không lưu trực tiếp dữ liệu thanh toán nhạy cảm

### 1. Nhóm
Security

### 2. Nội dung yêu cầu
Hệ thống không được lưu trực tiếp dữ liệu thanh toán nhạy cảm do Payment Provider quản lý; giao dịch điện tử phải đi qua Payment Provider.

### 3. Phạm vi áp dụng
- FR/FR con: FR34, FR35, FR62
- BP/Step: BP-04 (tính cước & thanh toán)
- Rule/Exception: BR_12

### 4. Tiêu chí kiểm tra
- Không tồn tại trường lưu dữ liệu thanh toán nhạy cảm; kết quả giao dịch được nhận qua Payment Provider.

### 5. Mức độ
Cao

### 6. Nguồn và trạng thái
| Thành phần | Giá trị |
| --- | --- |
| Nguồn | BR12, BR24 |
| BR | BR12, BR24 |
| FR/FR con | FR62 |
| Rule/Exception | BR_12 |
| Trạng thái | Đã xác nhận |

---

## NFR-06 — Tính nhất quán trạng thái chuyến

### 1. Nhóm
Reliability

### 2. Nội dung yêu cầu
Hệ thống phải đảm bảo chuyến chỉ chuyển trạng thái theo thứ tự hợp lệ; cập nhật trạng thái không hợp lệ bị từ chối và giữ nguyên trạng thái hiện tại.

### 3. Phạm vi áp dụng
- FR/FR con: FR21–FR24, FR27
- BP/Step: BP-03 (thực hiện chuyến đi)
- Rule/Exception: BR_07, BR_08, EX09

### 4. Tiêu chí kiểm tra
- Cập nhật trạng thái sai thứ tự bị từ chối; trạng thái chuyến không thay đổi.

### 5. Mức độ
Cao

### 6. Nguồn và trạng thái
| Thành phần | Giá trị |
| --- | --- |
| Nguồn | BR08, BR_07 |
| BR | BR08 |
| FR/FR con | FR21–FR24 |
| Rule/Exception | BR_07/BR_08/EX09 |
| Trạng thái | Đã xác nhận |

---

## NFR-08 — Hạn chế ảnh hưởng khi thanh toán/thông báo gặp lỗi

### 1. Nhóm
Reliability

### 2. Nội dung yêu cầu
Khi thanh toán hoặc thông báo gặp lỗi, hệ thống phải hạn chế ảnh hưởng, ghi nhận đúng trạng thái và không làm hỏng trạng thái chuyến chính.

### 3. Phạm vi áp dụng
- FR/FR con: FR34–FR37, FR38–FR43
- BP/Step: BP-04 (thanh toán), BP-02/BP-03 (thông báo)
- Rule/Exception: BR_13, BR_21, EX05

### 4. Tiêu chí kiểm tra
- Lỗi thanh toán/thông báo được ghi nhận và xử lý theo policy; trạng thái chuyến không bị cập nhật sai.

### 5. Mức độ
Cao

### 6. Nguồn và trạng thái
| Thành phần | Giá trị |
| --- | --- |
| Nguồn | BR26, BR_13 |
| BR | BR26 |
| FR/FR con | FR36/FR37 |
| Rule/Exception | BR_13/BR_21/EX05 |
| Trạng thái | Đã xác nhận (policy retry chờ OI07) |

---

# IX. KIỂM TRA FR/RULE/EXCEPTION → NFR

| FR/Rule/Exception | NFR liên quan | Nhóm NFR | Có yêu cầu chất lượng cần thiết? | Bao phủ đầy đủ? | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| FR01/FR03/FR59/BR_01 | NFR-01 | Security | Có | Có | Xác thực bắt buộc |
| FR54/FR60/EX06/EX08 | NFR-02 | Security | Có | Có | Chờ OI08 chi tiết role |
| FR34/FR35/FR62/BR_12 | NFR-03 | Security | Có | Có | Không lưu thẻ |
| FR20/BR_09/BR_20/EX08 | NFR-04 | Security | Có | Có | Chờ OI10 chính sách vị trí |
| FR61/BR_19 | NFR-05 | Security | Có | Có | Audit |
| FR21–FR24/FR27/EX09 | NFR-06 | Reliability | Có | Có | Thứ tự trạng thái |
| FR08/FR09/FR30/FR35/FR47 | NFR-07 | Reliability | Có | Có | Không mất dữ liệu |
| FR34–FR37/FR38–FR43/EX05 | NFR-08 | Reliability | Có | Có | Cô lập lỗi ngoài |
| FR07–FR27/FR32–FR37 | NFR-09 | Performance | Cần làm rõ | Chưa | Chưa có ngưỡng tải/thời gian |
| FR10/FR17/FR25/FR36/EX01/EX05 | NFR-10 | Usability | Có | Có | Thông báo rõ |
| BR_28/BR_29 | NFR-11 | Maintainability | Có | Có | Mở rộng từng phần |
| FR34/FR35/FR38–FR43 | NFR-12 | Compatibility | Có | Có | Tích hợp provider |
| FR09/FR30/FR35/FR47/BR_22 | NFR-13 | Backup & Recovery | Cần làm rõ | Chưa | Chờ OI06 chính sách lưu trữ |

**Kiểm tra:**
1. Các chức năng quan trọng (đặt xe, matching, chuyến, thanh toán, thông báo) đều có NFR cần thiết về bảo mật/độ tin cậy.
2. Các Rule/Exception quan trọng (BR_01, BR_07, BR_08, BR_12, BR_13, EX06, EX09) đã có NFR tương ứng.
3. Không có NFR nào không truy xuất được về nguồn.
4. Không có NFR nào thực chất là FR (không sinh chức năng mới).

---# X. KIỂM TRA PHẠM VI VÀ TÍNH KHẢ THI

| NFR ID | Trong phạm vi? | Có khả năng vượt phạm vi? | Có cơ sở kiểm tra? | Trạng thái | Xử lý |
| --- | --- | --- | --- | --- | --- |
| NFR-01 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-02 | Có | Không | Có | Đã xác nhận | Giữ lại (role chờ OI08) |
| NFR-03 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-04 | Có | Không | Có | Cần làm rõ | Chờ OI10 chính sách vị trí |
| NFR-05 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-06 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-07 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-08 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-09 | Có | Không | Chưa | Cần làm rõ | Xác nhận ngưỡng tải/thời gian |
| NFR-10 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-11 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-12 | Có | Không | Có | Đã xác nhận | Giữ lại |
| NFR-13 | ? | Có | Chưa | Cần làm rõ | Xác nhận (đồ án nhỏ) |

- NFR-13 (Backup & Recovery): **[Có khả năng vượt phạm vi đồ án — cần xác nhận]** — với đồ án 7 tuần, cơ chế sao lưu phức tạp có thể vượt phạm vi; chỉ yêu cầu mức cơ bản nếu dữ liệu thực sự cần.

---

# XI. KIỂM TRA TÍNH ĐẦY ĐỦ VÀ NHẤT QUÁN

### 11.1. NFR trùng FR
Không phát hiện NFR mô tả chức năng mới.

### 11.2. NFR không đo kiểm được
NFR-09 (Performance) và NFR-13 (Backup & Recovery) chưa có cơ sở định lượng → ghi **[Cần làm rõ]**.

### 11.3. NFR thiếu nguồn
Không có; mọi NFR đều truy xuất về BR/FR/Rule cụ thể.

### 11.4. NFR quá cao
NFR-13 có khả năng vượt phạm vi đồ án nhỏ.

### 11.5. NFR thiếu bao phủ
Các chức năng cốt lõi (matching, chuyến, thanh toán) đã có NFR bảo mật/độ tin cậy đầy đủ.

### 11.6. NFR trùng lặp
Không phát hiện trùng lặp thuộc tính.

| Issue ID | NFR ID | Nội dung | Phân tích | Ảnh hưởng | Xử lý/Đề xuất |
| --- | --- | --- | --- | --- | --- |
| NFR-I01 | NFR-09 | Thiếu ngưỡng thời gian phản hồi/số người dùng | Nguồn chưa cung cấp con số | Khó đo kiểm định lượng | Ghi **[Cần làm rõ]**, xác nhận với stakeholder |
| NFR-I02 | NFR-13 | Backup & Recovery chưa có cơ sở | BR_22 phụ thuộc OI06 | Có thể vượt phạm vi đồ án | Khoanh vùng mức cơ bản, cần xác nhận |
| NFR-I03 | NFR-04 | Chính sách vị trí chưa rõ | Phụ thuộc OI10 | Khó xác định ranh giới truy cập | Chờ OI10 |

---

# XII. TỔNG HỢP NFR THEO NHÓM

| Nhóm NFR | Số lượng | NFR quan trọng nhất | NFR cần làm rõ |
| --- | ---: | --- | --- |
| Performance | 1 | NFR-09 | NFR-09 |
| Security | 5 | NFR-01, NFR-02, NFR-03 | NFR-04 |
| Usability | 1 | NFR-10 | — |
| Reliability | 3 | NFR-06, NFR-08 | — |
| Maintainability | 1 | NFR-11 | — |
| Compatibility | 1 | NFR-12 | — |
| Backup & Recovery | 1 | NFR-13 | NFR-13 |

---

# XIII. TỔNG HỢP VÀ KẾT LUẬN

| Thành phần | Số lượng |
| --- | ---: |
| Tổng số NFR | 13 |
| NFR mức Cao | 8 |
| NFR mức Trung bình | 4 |
| NFR mức Thấp | 1 |
| NFR đã xác nhận | 10 |
| NFR suy ra | 0 |
| NFR cần làm rõ | 3 |
| NFR ngoài phạm vi | 0 |
| NFR có khả năng vượt phạm vi | 1 |
| NFR trùng FR | 0 |
| NFR thiếu tiêu chí kiểm tra | 2 |

## NFR chính
- NFR-01 (xác thực), NFR-02 (phân quyền), NFR-03 (không lưu dữ liệu thanh toán nhạy cảm).
- NFR-06 (nhất quán trạng thái chuyến), NFR-08 (cô lập lỗi thanh toán/thông báo).

## NFR cần làm rõ
- NFR-04 (chính sách vị trí — OI10).
- NFR-09 (ngưỡng hiệu năng — chưa có con số).
- NFR-13 (Backup & Recovery — OI06/OI07, có khả năng vượt phạm vi).

## Các vấn đề phát hiện
- NFR-I01: thiếu ngưỡng hiệu năng định lượng.
- NFR-I02: Backup & Recovery có khả năng vượt phạm vi đồ án nhỏ.
- NFR-I03: chính sách dữ liệu vị trí chưa được xác nhận (OI10).

---

# XIV. GIỚI HẠN CỦA BƯỚC 11

Bước này chỉ thực hiện **FR/Rule/Exception → Non-Functional Requirement**. Không tạo FR/Rule/Exception mới, không thiết kế kiến trúc/database, không chọn công nghệ, không xác định Actor/Use Case, không viết code.

# XV. ĐẦU RA CHUYỂN TIẾP

Kết quả là đầu vào tham khảo cho:
- `12_MoHinhHoaDuLieu.md`
- `13_XacDinhActor_UseCase.md`
- `15_DacTaUseCase.md`
- `16_XacDinhAcceptanceCriteria_AC.md`

Luồng truy xuất: **NEED → STK → SCOPE → BR → BP → Step → FR → FR con → Rule/Exception → NFR → DATA → ACTOR/UC → AC → RTM**