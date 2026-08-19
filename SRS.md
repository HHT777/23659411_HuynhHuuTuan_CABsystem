# B1. Đọc và phân tích yêu cầu

## 1.1. Business Context

ABC là doanh nghiệp cung cấp dịch vụ đặt xe trực tuyến. Hiện tại khách hàng sử dụng tổng đài hoặc ứng dụng đơn giản để yêu cầu xe.

ABC muốn xây dựng CAB System dưới dạng backend service/API để hỗ trợ quy trình đặt xe và tạo nền tảng có khả năng mở rộng khi số lượng khách hàng, tài xế và nhu cầu dịch vụ tăng.

## 1.2. Business Problem

| ID | Vấn đề |
|---|---|
| BP01 | Phân công tài xế chủ yếu thủ công, khó đáp ứng khi số lượng yêu cầu tăng. |
| BP02 | Khách hàng khó theo dõi tài xế và trạng thái chuyến đi. |
| BP03 | Thông tin và kết quả thanh toán chưa được quản lý tập trung. |
| BP04 | Hệ thống hiện tại khó mở rộng và bổ sung chức năng mới. |
| BP05 | Lỗi ở thanh toán/thông báo có nguy cơ ảnh hưởng hoạt động chung; hệ thống cần ổn định khi tải tăng. |
| BP06 | Khả năng quản lý, theo dõi và xử lý sự cố của bộ phận vận hành còn hạn chế. |

## 1.3. Mục tiêu kinh doanh

- Tự động hóa quy trình tìm và phân công tài xế.
- Cải thiện khả năng theo dõi chuyến đi.
- Hỗ trợ tính cước và thanh toán.
- Nâng cao hiệu quả vận hành.
- Cung cấp dữ liệu và báo cáo.
- Bảo vệ dữ liệu và kiểm soát thao tác nhạy cảm.
- Đảm bảo hệ thống ổn định khi nhu cầu tăng.
- Tạo nền tảng để mở rộng dịch vụ và chức năng trong tương lai.

## 1.4. Business Value

| Hệ thống hiện tại | CAB System |
|---|---|
| Phân công tài xế thủ công | Hỗ trợ matching tự động |
| Khó theo dõi chuyến | Theo dõi trạng thái và thông tin tài xế |
| Thanh toán chưa tập trung | Quản lý kết quả thanh toán |
| Khó mở rộng | Có khả năng mở rộng và phát triển thêm |
| Hỗ trợ vận hành hạn chế | Quản trị và theo dõi tập trung |

## 1.5. Business Context chính

Khách hàng đặt xe
→ Hệ thống tìm tài xế
→ Tài xế nhận/từ chối
→ Tiếp tục tìm nếu cần
→ Thực hiện chuyến
→ Hoàn thành
→ Tính cước
→ Thanh toán
→ Thông báo
→ Lịch sử/đánh giá

## 1.6. Open Issues

- OI01: Cách tính cước.
- OI02: Tiêu chí ưu tiên tài xế.
- OI03: Thời gian tài xế phải phản hồi.
- OI04: Chính sách hủy chuyến.
- OI05: Xử lý mất kết nối.
- OI06: Thời gian lưu trữ dữ liệu.
- OI07: Xử lý lại khi thanh toán thất bại.
- OI08: Phân quyền chi tiết.
- OI09: Chi tiết báo cáo.
- OI10: Chính sách dữ liệu vị trí.

# B2. Xác định Stakeholders

## 2.1. Stakeholders

| Stakeholder | Vai trò |
|---|---|
| Ban lãnh đạo ABC | Xác định mục tiêu, ưu tiên và đánh giá hiệu quả kinh doanh. |
| Khách hàng | Đặt xe, theo dõi chuyến, thanh toán, xem lịch sử và đánh giá. |
| Tài xế | Quản lý trạng thái, nhận/từ chối chuyến và cập nhật trạng thái chuyến. |
| Nhân viên vận hành | Quản lý khách hàng, tài xế, phương tiện, chuyến đi và xử lý sự cố. |
| Admin / người có quyền quản trị (cần xác nhận) | Thực hiện các thao tác quản trị nhạy cảm theo phân quyền. |
| BA | Làm rõ yêu cầu, business process, business rule và các vấn đề chưa xác định. |
| Development Team | Xây dựng, kiểm thử và triển khai backend service/API. |
| Payment Provider | Xử lý thanh toán điện tử bên ngoài. |
| Notification Provider | Cung cấp kênh gửi thông báo. |
| Tổng đài/CS hiện tại | Quy trình hiện tại, có thể bị ảnh hưởng khi chuyển sang hệ thống mới. |

## 2.2. Stakeholder Matrix

<img width="940" height="874" alt="image" src="https://github.com/user-attachments/assets/73a40ec9-26d9-459e-86ec-65e74591f650" />


# B3. Xác định Business Goals

| ID | Business Goal | BP liên quan |
|---|---|---|
| BG01 | Hỗ trợ quy trình đặt xe từ tạo yêu cầu đến hoàn thành chuyến. | BP01, BP02 |
| BG02 | Nâng cao hiệu quả tìm và phân công tài xế phù hợp. | BP01 |
| BG03 | Nâng cao khả năng theo dõi và minh bạch trạng thái chuyến. | BP02 |
| BG04 | Hỗ trợ xác định số tiền khách hàng phải trả. | BP03 |
| BG05 | Hỗ trợ thanh toán bằng tiền mặt và điện tử. | BP03 |
| BG06 | Đảm bảo thông báo cho khách hàng và tài xế tại các mốc chính. | BP02, BP04 |
| BG07 | Nâng cao khả năng quản lý và kiểm soát vận hành. | BP06 |
| BG08 | Cung cấp dữ liệu và báo cáo phục vụ quản lý. | BP06 |
| BG09 | Bảo vệ dữ liệu và kiểm soát thao tác nhạy cảm. | BP06 |
| BG10 | Duy trì hoạt động ổn định khi nhu cầu tăng cao. | BP05 |
| BG11 | Tạo nền tảng để mở rộng quy mô và chức năng trong tương lai. | BP04, BP05 |
| BG12 | Hỗ trợ xử lý các trường hợp ngoại lệ trong quy trình đặt xe, chuyến đi và thanh toán. | BP01, BP03, BP05 |
| BG13 | Thu thập đánh giá sau chuyến để hỗ trợ đánh giá chất lượng dịch vụ. | BP02, BP06 |

# B4. Xác định Scope

## 4.1. In-Scope

| Nhóm | Phạm vi | BG |
|---|---|---|
| Tài khoản | Đăng ký, đăng nhập, cập nhật hồ sơ khách hàng/tài xế | BG01, BG09 |
| Đặt xe | Điểm đón, điểm đến, loại xe, tạo yêu cầu | BG01 |
| Matching | Tìm tài xế, nhận/từ chối, không phản hồi, tìm tài xế tiếp theo | BG02, BG12 |
| Chuyến đi | Quản lý trạng thái chuyến | BG03 |
| Vị trí | Lưu vị trí tài xế phục vụ matching/ETA | BG02, BG03, BG09 |
| Tính cước | Xác định số tiền phải trả | BG04 |
| Thanh toán | Tiền mặt, điện tử, Payment Provider, xử lý thất bại | BG05, BG12 |
| Thông báo | Các sự kiện chính của chuyến và thanh toán | BG06 |
| Lịch sử/đánh giá | Lịch sử chuyến, số tiền, đánh giá tài xế | BG01, BG13 |
| Vận hành | Quản lý khách hàng, tài xế, phương tiện, chuyến đi, lỗi | BG07, BG12 |
| Báo cáo | Chuyến, doanh thu, hoàn thành, hủy, hiệu quả tài xế | BG08 |
| Bảo mật | Xác thực, phân quyền, bảo vệ dữ liệu, audit | BG09 |
| Reliability/Scalability | Ổn định khi tải tăng, hạn chế ảnh hưởng khi một thành phần lỗi | BG10 |
| Extensibility | Hỗ trợ mở rộng dịch vụ, thanh toán, notification | BG11 |

### Technical Scope

- Xây dựng backend service/API cho các nghiệp vụ trong phạm vi.
- Tập trung vào minimal viable backend trong thời gian 7 tuần.
- Thiết kế API đủ để client/ứng dụng sử dụng các nghiệp vụ cốt lõi.
- Chi tiết công nghệ/kiến trúc sẽ xác định ở các bước sau.

## 4.2. Out-of-Scope hiện tại

- UI/mobile/web client.
- AI/ML tối ưu tuyến đường.
- AI/ML dự đoán ETA.
- Khuyến mãi/mã giảm giá.
- Ví điện tử nội bộ.
- Chat khách hàng – tài xế.
- Đa ngôn ngữ/đa tiền tệ.
- BI/Dashboard nâng cao.
- Offline-first.
- Các công nghệ kiến trúc cụ thể chưa được quyết định.

## 4.3. Ưu tiên

**P0 – Core**
BG01, BG02, BG03, BG04, BG05, BG06, BG12

**P1 – Operations & Control**
BG07, BG08, BG09, BG13

**P2 – Growth**
BG10, BG11

P0 là phạm vi tối thiểu ưu tiên cho backend service trong 7 tuần. P1/P2 được triển khai tùy nguồn lực và ưu tiên được stakeholder xác nhận.

# B5. Business Requirements

| ID | Business Requirement | BG | Scope |
|---|---|---|---|
| BR01 | Hệ thống phải hỗ trợ khách hàng và tài xế đăng ký, đăng nhập và cập nhật thông tin cá nhân. | BG01, BG09 | Tài khoản |
| BR02 | Hệ thống phải cho phép khách hàng nhập điểm đón, điểm đến, chọn loại xe và tạo yêu cầu đặt xe. | BG01 | Đặt xe |
| BR03 | Hệ thống phải xác định tài xế phù hợp dựa trên vị trí, trạng thái sẵn sàng và tiêu chí vận hành. | BG02 | Matching |
| BR04 | Hệ thống phải cho phép tài xế chuyển trạng thái sẵn sàng nhận chuyến. | BG02 | Tài khoản/Matching |
| BR05 | Hệ thống phải cho phép tài xế chấp nhận hoặc từ chối chuyến. | BG02 | Matching |
| BR06 | Khi tài xế từ chối hoặc không phản hồi, hệ thống phải tiếp tục tìm tài xế khác mà không yêu cầu khách hàng tạo lại yêu cầu. | BG02, BG12 | Matching |
| BR07 | Khi không tìm được tài xế, hệ thống phải thông báo cho khách hàng. | BG02, BG12 | Matching/Notification |
| BR08 | Hệ thống phải cập nhật trạng thái chuyến từ tìm tài xế đến hoàn thành chuyến. | BG03 | Chuyến đi |
| BR09 | Hệ thống phải lưu vị trí tài xế để hỗ trợ matching và dự kiến thời gian đến. | BG02, BG03, BG09 | Vị trí |
| BR10 | Hệ thống phải xác định số tiền khách hàng phải trả dựa trên loại dịch vụ và thông tin chuyến. | BG04 | Tính cước |
| BR11 | Hệ thống phải hỗ trợ thanh toán tiền mặt và thanh toán điện tử. | BG05 | Thanh toán |
| BR12 | Hệ thống phải tích hợp Payment Provider và không lưu trực tiếp dữ liệu thanh toán nhạy cảm. | BG05, BG09 | Thanh toán |
| BR13 | Khi thanh toán điện tử thất bại, hệ thống phải thông báo và hỗ trợ xử lý lại theo chính sách doanh nghiệp. | BG05, BG12 | Thanh toán |
| BR14 | Hệ thống phải gửi thông báo cho khách hàng tại các mốc chính của chuyến và thanh toán. | BG06 | Notification |
| BR15 | Hệ thống phải gửi thông báo cho tài xế khi có chuyến mới hoặc thay đổi chuyến. | BG06 | Notification |
| BR16 | Hệ thống phải cho phép khách hàng xem lịch sử chuyến và số tiền phải trả. | BG01, BG04 | Lịch sử |
| BR17 | Hệ thống phải cho phép khách hàng đánh giá tài xế sau chuyến. | BG13 | Đánh giá |
| BR18 | Hệ thống phải hỗ trợ nhân viên vận hành quản lý khách hàng, tài xế, phương tiện và chuyến đi. | BG07 | Vận hành |
| BR19 | Hệ thống phải hỗ trợ theo dõi chuyến đang diễn ra và trạng thái tài xế. | BG07 | Vận hành |
| BR20 | Hệ thống phải hỗ trợ xử lý chuyến bị lỗi và tra cứu lịch sử giao dịch. | BG07, BG12 | Vận hành |
| BR21 | Hệ thống phải kiểm soát quyền truy cập đối với chức năng quản trị nhạy cảm. | BG09 | Bảo mật |
| BR22 | Hệ thống phải cung cấp báo cáo về số chuyến, doanh thu, hoàn thành, hủy và hiệu quả tài xế. | BG08 | Báo cáo |
| BR23 | Hệ thống phải xác thực khách hàng và tài xế trước các chức năng yêu cầu tài khoản. | BG09 | Bảo mật |
| BR24 | Hệ thống phải bảo vệ thông tin cá nhân, phương tiện, vị trí và giao dịch. | BG09 | Bảo mật |
| BR25 | Hệ thống phải lưu vết các thao tác quan trọng. | BG09 | Audit |
| BR26 | Hệ thống phải duy trì hoạt động ổn định khi nhu cầu tăng và hạn chế ảnh hưởng khi thanh toán/thông báo gặp lỗi. | BG10 | Reliability |
| BR27 | Hệ thống phải có khả năng mở rộng để phục vụ số lượng lớn khách hàng và tài xế. | BG10, BG11 | Scalability |
| BR28 | Hệ thống phải hỗ trợ mở rộng loại dịch vụ, phương thức thanh toán và kênh/nhà cung cấp thông báo. | BG11 | Extensibility |
| BR29 | Hệ thống phải hỗ trợ triển khai chức năng mới từng phần với ảnh hưởng hạn chế đến chức năng đang hoạt động. | BG11 | Extensibility |

## 5.1. Open Issues ảnh hưởng BR

| BR | Open Issue |
|---|---|
| BR03, BR06 | OI02 – Tiêu chí ưu tiên tài xế |
| BR06 | OI03 – Thời gian tài xế phản hồi |
| BR10 | OI01 – Cách tính cước |
| BR13 | OI07 – Xử lý thanh toán thất bại |
| BR21 | OI08 – Phân quyền chi tiết |
| BR22 | OI09 – Chi tiết báo cáo |
| BR24 | OI06, OI10 – Lưu trữ và bảo vệ dữ liệu |
| BR26 | OI05 – Xử lý mất kết nối |
| BR16 | OI04 – Chính sách hủy chuyến |

## 5.2. Traceability chính

B1 Business Problems
↓
B3 Business Goals
↓
B4 Scope
↓
B5 Business Requirements
↓
B6 Functional Requirements / Use Cases / Business Rules
↓
NFR + API Specification

Các BR01–BR25 là nghiệp vụ chính trong baseline scope. BR26–BR29 mô tả capability cần có và sẽ được chi tiết hóa thành NFR/Architecture Requirements ở các bước sau.

# B6. Business Process

## 6.1. Danh sách Business Process

ID	Business Process	BR liên quan
BP-01	Quản lý tài khoản và trạng thái tài xế	BR01, BR04
BP-02	Đặt xe và tìm tài xế	BR02, BR03, BR05, BR06, BR07, BR09, BR14
BP-03	Thực hiện chuyến đi	BR08, BR09, BR14, BR15
BP-04	Tính cước và thanh toán	BR10, BR11, BR12, BR13, BR14
BP-05	Lịch sử và đánh giá sau chuyến	BR16, BR17
BP-06	Vận hành và xử lý sự cố	BR18, BR19, BR20, BR21
BP-07	Báo cáo và theo dõi hoạt động	BR22
BR23–BR29 là các yêu cầu xuyên suốt về xác thực, bảo vệ dữ liệu, audit, reliability, scalability và extensibility; không tạo thành một business process độc lập.

## 6.2. BP-01: Quản lý tài khoản và trạng thái tài xế

<img width="940" height="1110" alt="image" src="https://github.com/user-attachments/assets/cf88c6ad-aa4d-4e51-8665-f1fe497cf4e6" />
## 6.3. BP-02: Đặt xe và tìm tài xế

<img width="717" height="1299" alt="image" src="https://github.com/user-attachments/assets/81f1e926-6227-442f-866f-0b2b348e2c70" />
Tiêu chí ưu tiên tài xế và thời gian phản hồi cụ thể phụ thuộc OI02, OI03.

## 6.4. BP-03: Thực hiện chuyến đi

<img width="940" height="1361" alt="image" src="https://github.com/user-attachments/assets/11cb9086-5a25-410d-ba7c-bd4991343889" />

Cách cập nhật và tần suất cập nhật vị trí chưa được khách hàng xác định.
## 6.5. BP-04: Tính cước và thanh toán

<img width="738" height="1331" alt="image" src="https://github.com/user-attachments/assets/3b266961-d9ba-49b0-9096-855ede3702d7" />
Việc xử lý lại giao dịch phụ thuộc OI07; không mặc định retry vô hạn.

## 6.6. BP-05: Lịch sử và đánh giá sau chuyến

<img width="940" height="1204" alt="image" src="https://github.com/user-attachments/assets/267fac6d-2dcb-409a-9b1b-9d3579fc0438" />

## 6.7. BP-06: Vận hành và xử lý sự cố

<img width="940" height="1039" alt="image" src="https://github.com/user-attachments/assets/c0a28ca4-7d50-4f41-84a6-a225ec85460c" />
Chi tiết role và permission phụ thuộc OI08.

## 6.8. BP-07: Báo cáo và theo dõi hoạt động 

<img width="940" height="491" alt="image" src="https://github.com/user-attachments/assets/95444319-8d7d-4436-a0d4-8c4d94cb8aba" />
Chi tiết chỉ số và cách tính báo cáo phụ thuộc OI09.

## 6.9. Mối liên hệ giữa các Business Process
<img width="940" height="359" alt="image" src="https://github.com/user-attachments/assets/74ce07b0-f76a-47a8-b34c-feca6ae51f56" />

## 6.10. Luồng nghiệp vụ tổng thể 

<img width="940" height="97" alt="image" src="https://github.com/user-attachments/assets/57af059b-9214-4c7f-a5aa-d3abd28b1cdb" />
Luồng chính: BP-01 → BP-02 → BP-03 → BP-04 → BP-05
Luồng hỗ trợ: BP-06 giám sát và can thiệp khi có vấn đề; BP-07 sử dụng dữ liệu từ các process để phục vụ báo cáo.

### B7. Phân rã yêu cầu chức năng (Functional Requirements)

### 7.1. FR – Quản lý tài khoản và trạng thái tài xế

| ID   | Functional Requirement                                                               | BR         | BP           |
| ---- | ------------------------------------------------------------------------------------ | ---------- | ------------ |
| FR01 | API phải cho phép khách hàng đăng ký tài khoản.                                      | BR01       | BP-01        |
| FR02 | API phải cho phép tài xế đăng ký hoặc tiếp nhận tài khoản do nhân viên vận hành tạo. | BR01       | BP-01        |
| FR03 | API phải xác thực thông tin đăng nhập của khách hàng và tài xế.                      | BR01, BR23 | BP-01        |
| FR04 | API phải cho phép khách hàng và tài xế cập nhật thông tin cá nhân.                   | BR01       | BP-01        |
| FR05 | API phải cho phép tài xế cập nhật trạng thái Sẵn sàng/Không sẵn sàng.                | BR04       | BP-01        |
| FR06 | API phải trả về danh sách tài xế đang sẵn sàng nhận chuyến cho nghiệp vụ matching.   | BR03, BR04 | BP-01, BP-02 |

### 7.2. FR – Đặt xe

| ID   | Functional Requirement                                                     | BR         | BP    |
| ---- | -------------------------------------------------------------------------- | ---------- | ----- |
| FR07 | API phải tiếp nhận điểm đón, điểm đến và loại xe từ yêu cầu đặt xe.        | BR02       | BP-02 |
| FR08 | API phải tạo một yêu cầu đặt xe và sinh mã định danh duy nhất cho yêu cầu. | BR02       | BP-02 |
| FR09 | API phải lưu trạng thái yêu cầu đặt xe và thời điểm tạo yêu cầu.           | BR02, BR08 | BP-02 |
| FR10 | API phải trả trạng thái tiếp nhận yêu cầu cho khách hàng.                  | BR14       | BP-02 |

### 7.3. FR – Matching và tìm tài xế

| ID   | Functional Requirement                                                                                                           | BR         | BP    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----- |
| FR11 | Hệ thống phải lấy danh sách tài xế đang sẵn sàng và có dữ liệu vị trí hợp lệ.                                                    | BR03, BR09 | BP-02 |
| FR12 | Hệ thống phải xác định khoảng cách giữa điểm đón và vị trí tài xế để hỗ trợ lựa chọn tài xế phù hợp.                             | BR03, BR09 | BP-02 |
| FR13 | Hệ thống phải áp dụng các tiêu chí ưu tiên tài xế đã được doanh nghiệp xác nhận để sắp xếp danh sách tài xế.                     | BR03       | BP-02 |
| FR14 | Hệ thống phải gửi đề xuất chuyến đến tài xế được chọn.                                                                           | BR05       | BP-02 |
| FR15 | API phải tiếp nhận kết quả Chấp nhận/Từ chối của tài xế.                                                                         | BR05       | BP-02 |
| FR16 | Khi tài xế từ chối hoặc hết thời gian phản hồi, hệ thống phải chuyển sang tài xế tiếp theo mà không tạo lại yêu cầu đặt xe.      | BR06       | BP-02 |
| FR17 | Khi không còn tài xế phù hợp, hệ thống phải cập nhật yêu cầu thành trạng thái không tìm được tài xế và thông báo cho khách hàng. | BR07       | BP-02 |

Tiêu chí sắp xếp tài xế và thời gian chờ phản hồi phụ thuộc OI02, OI03.

### 7.4. FR – Quản lý vị trí tài xế

| ID   | Functional Requirement                                                               | BR   | BP           |
| ---- | ------------------------------------------------------------------------------------ | ---- | ------------ |
| FR18 | API phải cho phép tài xế gửi thông tin vị trí hiện tại.                              | BR09 | BP-02, BP-03 |
| FR19 | Hệ thống phải lưu vị trí mới nhất của tài xế phục vụ matching và vận hành.           | BR09 | BP-02, BP-03 |
| FR20 | Hệ thống phải cung cấp vị trí mới nhất của tài xế cho các nghiệp vụ được phân quyền. | BR09 | BP-02, BP-03 |

Cách lấy vị trí từ client và tần suất cập nhật chưa được đặc tả trong yêu cầu; sẽ xác định ở API/technical design.

### 7.5. FR – Thực hiện và theo dõi chuyến đi

| ID   | Functional Requirement                                                                    | BR               | BP    |
| ---- | ----------------------------------------------------------------------------------------- | ---------------- | ----- |
| FR21 | API phải cho phép tài xế cập nhật trạng thái Đã đến điểm đón.                             | BR08             | BP-03 |
| FR22 | API phải cho phép tài xế cập nhật trạng thái Đã đón khách.                                | BR08             | BP-03 |
| FR23 | API phải cho phép cập nhật trạng thái Đang di chuyển.                                     | BR08             | BP-03 |
| FR24 | API phải cho phép tài xế cập nhật trạng thái Hoàn thành chuyến.                           | BR08             | BP-03 |
| FR25 | API phải cung cấp trạng thái chuyến hiện tại cho khách hàng.                              | BR08             | BP-03 |
| FR26 | API phải cung cấp thông tin tài xế đã nhận chuyến và trạng thái liên quan cho khách hàng. | BR08, BR14       | BP-03 |
| FR27 | Hệ thống phải phát sinh các sự kiện nghiệp vụ tương ứng khi trạng thái chuyến thay đổi.   | BR08, BR14, BR15 | BP-03 |

### 7.6. FR – Tính cước

| ID   | Functional Requirement                                                                                                 | BR         | BP           |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ |
| FR28 | API phải nhận thông tin cần thiết của chuyến đã hoàn thành để tính cước.                                               | BR10       | BP-04        |
| FR29 | Hệ thống phải xác định số tiền phải trả dựa trên loại dịch vụ và thông tin chuyến theo business rule đã được xác nhận. | BR10       | BP-04        |
| FR30 | Hệ thống phải lưu số tiền phải trả cùng với thông tin chuyến.                                                          | BR10       | BP-04        |
| FR31 | API phải trả số tiền phải trả cho các nghiệp vụ thanh toán và tra cứu.                                                 | BR10, BR16 | BP-04, BP-05 |

Công thức tính cước cụ thể phụ thuộc OI01.

### 7.7. FR – Thanh toán

| ID   | Functional Requirement                                                                           | BR   | BP    |
| ---- | ------------------------------------------------------------------------------------------------ | ---- | ----- |
| FR32 | API phải cho phép xác định phương thức thanh toán của chuyến.                                    | BR11 | BP-04 |
| FR33 | Hệ thống phải ghi nhận kết quả thanh toán tiền mặt.                                              | BR11 | BP-04 |
| FR34 | Hệ thống phải gửi yêu cầu thanh toán điện tử đến Payment Provider.                               | BR12 | BP-04 |
| FR35 | Hệ thống phải tiếp nhận và lưu kết quả giao dịch từ Payment Provider.                            | BR12 | BP-04 |
| FR36 | Khi thanh toán thất bại, hệ thống phải cập nhật trạng thái thất bại và thông báo cho khách hàng. | BR13 | BP-04 |
| FR37 | Hệ thống phải hỗ trợ tạo lại/xử lý lại giao dịch theo chính sách thanh toán đã xác nhận.         | BR13 | BP-04 |

Chính sách retry cụ thể phụ thuộc OI07.

### 7.8. FR – Thông báo

| ID   | Functional Requirement                                                               | BR   | BP           |
| ---- | ------------------------------------------------------------------------------------ | ---- | ------------ |
| FR38 | Hệ thống phải phát sinh thông báo khi yêu cầu đặt xe được tiếp nhận.                 | BR14 | BP-02        |
| FR39 | Hệ thống phải phát sinh thông báo khi tài xế nhận chuyến.                            | BR14 | BP-02        |
| FR40 | Hệ thống phải phát sinh thông báo khi tài xế đến điểm đón.                           | BR14 | BP-03        |
| FR41 | Hệ thống phải phát sinh thông báo khi chuyến hoàn thành.                             | BR14 | BP-03        |
| FR42 | Hệ thống phải phát sinh thông báo khi thanh toán có kết quả.                         | BR14 | BP-04        |
| FR43 | Hệ thống phải phát sinh thông báo cho tài xế khi có chuyến mới hoặc thay đổi chuyến. | BR15 | BP-02, BP-03 |

### 7.9. FR – Lịch sử và đánh giá

| ID   | Functional Requirement                                                          | BR   | BP    |
| ---- | ------------------------------------------------------------------------------- | ---- | ----- |
| FR44 | API phải cho phép khách hàng truy vấn lịch sử chuyến của chính mình.            | BR16 | BP-05 |
| FR45 | API phải trả số tiền phải trả/thanh toán của từng chuyến trong lịch sử.         | BR16 | BP-05 |
| FR46 | API phải cho phép khách hàng gửi đánh giá cho tài xế sau khi chuyến hoàn thành. | BR17 | BP-05 |
| FR47 | Hệ thống phải lưu đánh giá gắn với chuyến và tài xế tương ứng.                  | BR17 | BP-05 |

### 7.10. FR – Vận hành và xử lý sự cố

| ID   | Functional Requirement                                                                | BR         | BP    |
| ---- | ------------------------------------------------------------------------------------- | ---------- | ----- |
| FR48 | API phải cung cấp dữ liệu khách hàng cho chức năng vận hành được phân quyền.          | BR18       | BP-06 |
| FR49 | API phải cung cấp dữ liệu tài xế và trạng thái hoạt động cho chức năng vận hành.      | BR18, BR19 | BP-06 |
| FR50 | API phải cung cấp dữ liệu phương tiện cho chức năng vận hành.                         | BR18       | BP-06 |
| FR51 | API phải cung cấp danh sách và trạng thái các chuyến đang diễn ra.                    | BR19       | BP-06 |
| FR52 | API phải hỗ trợ truy vấn thông tin chuyến để nhân viên vận hành xử lý trường hợp lỗi. | BR20       | BP-06 |
| FR53 | API phải hỗ trợ tra cứu lịch sử giao dịch phục vụ xử lý sự cố.                        | BR20       | BP-06 |
| FR54 | Hệ thống phải kiểm tra quyền trước khi thực hiện thao tác quản trị nhạy cảm.          | BR21, BR23 | BP-06 |

### 7.11. FR – Báo cáo

| ID   | Functional Requirement                                            | BR   | BP    |
| ---- | ----------------------------------------------------------------- | ---- | ----- |
| FR55 | API phải cung cấp dữ liệu tổng hợp số lượng chuyến.               | BR22 | BP-07 |
| FR56 | API phải cung cấp dữ liệu doanh thu.                              | BR22 | BP-07 |
| FR57 | API phải cung cấp tỷ lệ chuyến hoàn thành và tỷ lệ hủy.           | BR22 | BP-07 |
| FR58 | API phải cung cấp dữ liệu đánh giá hiệu quả hoạt động của tài xế. | BR22 | BP-07 |

### 7.12. FR – Xác thực, phân quyền và audit

| ID   | Functional Requirement                                                                       | BR         | BP                  |
| ---- | -------------------------------------------------------------------------------------------- | ---------- | ------------------- |
| FR59 | API phải yêu cầu xác thực đối với các chức năng có yêu cầu tài khoản.                        | BR23       | Tất cả BP liên quan |
| FR60 | Hệ thống phải xác định quyền của người dùng trước khi cho phép thao tác quản trị.            | BR21, BR23 | BP-06               |
| FR61 | Hệ thống phải ghi nhận các thao tác quan trọng cùng người thực hiện và thời điểm thực hiện.  | BR25       | Tất cả BP liên quan |
| FR62 | Hệ thống không được lưu trực tiếp dữ liệu thanh toán nhạy cảm được Payment Provider quản lý. | BR12, BR24 | BP-04               |

### 7.13. Các bài toán cần làm rõ khi thiết kế API

| ID    | Bài toán                                                                           | Liên quan        |
| ----- | ---------------------------------------------------------------------------------- | ---------------- |
| API01 | Làm sao lấy danh sách tài xế đang Sẵn sàng và có vị trí hợp lệ?                    | FR06, FR11, FR18 |
| API02 | Lấy vị trí mới nhất của tài xế từ đâu và cập nhật bằng API nào?                    | FR18, FR19       |
| API03 | Tính khoảng cách giữa điểm đón và vị trí tài xế như thế nào để phục vụ matching?   | FR12             |
| API04 | Sau khi sắp xếp tài xế, API nào gửi đề xuất chuyến và nhận phản hồi của tài xế?    | FR13, FR14, FR15 |
| API05 | Khi tài xế từ chối/không phản hồi, hệ thống xác định tài xế tiếp theo như thế nào? | FR16             |
| API06 | Trạng thái chuyến được cập nhật và trả về cho khách hàng theo cơ chế nào?          | FR21–FR27        |
| API07 | Payment Provider gửi kết quả giao dịch về hệ thống bằng cơ chế nào?                | FR34, FR35       |
| API08 | Khi thanh toán thất bại, quy trình xử lý lại được thực hiện theo chính sách nào?   | FR36, FR37       |
| API09 | Notification Provider nhận và xử lý sự kiện thông báo như thế nào?                 | FR38–FR43        |
| API10 | Role và permission nào được phép thực hiện từng thao tác quản trị?                 | FR54, FR60       |

### 7.14. Traceability

B1 Business Problem

↓

B3 Business Goal

↓

B4 Scope

↓

B5 Business Requirement

↓

B6 Business Process

↓

B7 Functional Requirement

↓

API / Data / Business Rule / NFR

Các FR trên được phân rã trực tiếp từ BR và Business Process đã xác định. Các vấn đề về API ở mục 7.13 là đầu vào cho bước thiết kế API tiếp theo; không tự quyết định công nghệ hoặc business rule khi Open Issue chưa được xác nhận.
### B8. Business Rules & Exception Rules

### 8.1. Business Rules

| ID    | Business Rule                                                                                                                                | Liên quan        | Trạng thái        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- |
| BR_01 | Chỉ khách hàng và tài xế đã xác thực mới được sử dụng các chức năng yêu cầu tài khoản.                                                       | BR01, BR23       | Đã xác định       |
| BR_02 | Tài xế chỉ được nhận chuyến khi đang ở trạng thái sẵn sàng nhận chuyến.                                                                      | BR03, BR04, BR05 | Đã xác định       |
| BR_03 | Chỉ tài xế phù hợp theo vị trí, trạng thái sẵn sàng và các tiêu chí vận hành đã được xác nhận mới được đề xuất chuyến.                       | BR03             | Chờ OI02          |
| BR_04 | Khi tài xế từ chối hoặc không phản hồi trong thời gian quy định, hệ thống phải tiếp tục tìm tài xế khác cho cùng yêu cầu đặt xe.             | BR06             | Chờ OI03          |
| BR_05 | Khách hàng không phải tạo lại yêu cầu khi hệ thống chuyển sang tìm tài xế khác.                                                              | BR06             | Đã xác định       |
| BR_06 | Khi không còn tài xế phù hợp, yêu cầu phải được kết thúc với trạng thái không tìm được tài xế và khách hàng phải được thông báo.             | BR07             | Đã xác định       |
| BR_07 | Chuyến chỉ được chuyển sang trạng thái tiếp theo khi trạng thái hiện tại hợp lệ theo quy trình chuyến đi.                                    | BR08             | Đã xác định       |
| BR_08 | Chỉ tài xế của chuyến mới được phép cập nhật các trạng thái thực hiện chuyến tương ứng.                                                      | BR08             | Cần chi tiết thêm |
| BR_09 | Vị trí tài xế chỉ được sử dụng cho các nghiệp vụ được phân quyền và phải được bảo vệ theo chính sách dữ liệu của doanh nghiệp.               | BR09, BR24       | Chờ OI10          |
| BR_10 | Số tiền phải trả được xác định sau khi chuyến hoàn thành dựa trên loại dịch vụ và thông tin chuyến.                                          | BR10             | Chờ OI01          |
| BR_11 | Khách hàng phải chọn một phương thức thanh toán được hệ thống hỗ trợ cho chuyến.                                                             | BR11             | Đã xác định       |
| BR_12 | Dữ liệu thanh toán nhạy cảm không được lưu trực tiếp trong CAB; giao dịch điện tử phải được xử lý thông qua Payment Provider.                | BR12, BR24       | Đã xác định       |
| BR_13 | Khi thanh toán điện tử thất bại, hệ thống phải ghi nhận trạng thái thất bại, thông báo khách hàng và xử lý lại theo chính sách doanh nghiệp. | BR13             | Chờ OI07          |
| BR_14 | Hệ thống chỉ ghi nhận giao dịch là thanh toán thành công khi nhận được kết quả thành công hợp lệ từ phương thức thanh toán tương ứng.        | BR11, BR12       | Đã xác định       |
| BR_15 | Các sự kiện nghiệp vụ quan trọng phải phát sinh thông báo tương ứng cho đúng đối tượng nhận.                                                 | BR14, BR15       | Đã xác định       |
| BR_16 | Khách hàng chỉ được xem lịch sử và thông tin của các chuyến thuộc tài khoản của mình.                                                        | BR16             | Đã xác định       |
| BR_17 | Khách hàng chỉ được đánh giá tài xế sau khi chuyến tương ứng đã hoàn thành.                                                                  | BR17             | Đã xác định       |
| BR_18 | Thao tác quản trị nhạy cảm chỉ được thực hiện bởi người dùng có quyền phù hợp.                                                               | BR21             | Chờ OI08          |
| BR_19 | Các thao tác quan trọng phải được lưu vết để xác định người thực hiện và thời điểm thao tác.                                                 | BR25             | Đã xác định       |
| BR_20 | Dữ liệu cá nhân, phương tiện, vị trí và giao dịch phải được bảo vệ theo chính sách của doanh nghiệp.                                         | BR24             | Đã xác định       |
| BR_21 | Khi mất kết nối, hệ thống phải xử lý trạng thái chuyến theo chính sách được doanh nghiệp xác nhận; không tự giả định cơ chế offline.         | BR26             | Chờ OI05          |
| BR_22 | Dữ liệu chỉ được lưu giữ trong thời gian theo chính sách lưu trữ của doanh nghiệp.                                                           | BR24             | Chờ OI06          |

### 8.2. Exception / Alternative Rules

| ID   | Tình huống                                 | Xử lý nghiệp vụ                                                                    |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| EX01 | Không tìm thấy tài xế                      | Kết thúc yêu cầu với trạng thái không tìm được tài xế và thông báo khách hàng.     |
| EX02 | Tài xế từ chối chuyến                      | Tiếp tục matching tài xế khác.                                                     |
| EX03 | Tài xế không phản hồi                      | Sau thời gian phản hồi được xác nhận, tiếp tục matching tài xế khác.               |
| EX04 | Không còn tài xế phù hợp                   | Không tiếp tục matching; thông báo khách hàng.                                     |
| EX05 | Thanh toán điện tử thất bại                | Ghi nhận thất bại, thông báo khách hàng và xử lý lại theo chính sách doanh nghiệp. |
| EX06 | Thao tác quản trị không có quyền           | Từ chối thao tác và không thay đổi dữ liệu nghiệp vụ.                              |
| EX07 | Mất kết nối trong chuyến                   | Giữ/xử lý trạng thái theo chính sách mất kết nối được xác nhận.                    |
| EX08 | Yêu cầu truy cập dữ liệu không thuộc quyền | Từ chối truy cập và ghi nhận nếu thuộc nhóm thao tác cần audit.                    |
| EX09 | Cập nhật trạng thái chuyến không hợp lệ    | Từ chối cập nhật và giữ nguyên trạng thái hiện tại.                                |

### 8.3. Quy tắc chuyển trạng thái chuyến

<img width="1356" height="239" alt="image" src="https://github.com/user-attachments/assets/28707608-6507-406f-b795-e9e9f87c556e" />


Các chuyển trạng thái ngoài luồng trên phải được từ chối hoặc xử lý theo exception phù hợp.

### 8.4. Business Rules cần xác nhận với khách hàng

| ID   | Nội dung cần xác nhận                        |
| ---- | -------------------------------------------- |
| OI01 | Công thức và bảng giá tính cước              |
| OI02 | Tiêu chí ưu tiên và lựa chọn tài xế          |
| OI03 | Thời gian tài xế phải phản hồi               |
| OI04 | Chính sách hủy chuyến                        |
| OI05 | Xử lý khi mất kết nối mạng                   |
| OI06 | Thời gian lưu trữ dữ liệu                    |
| OI07 | Chính sách xử lý lại khi thanh toán thất bại |
| OI08 | Chi tiết role và quyền quản trị              |
| OI09 | Chi tiết chỉ số và báo cáo                   |
| OI10 | Chính sách bảo vệ và sử dụng dữ liệu vị trí  |

Các giá trị chưa được khách hàng xác nhận không được tự đặt trong Business Rule; chỉ đặc tả sau khi stakeholder xác nhận.











