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
