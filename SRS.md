# B1. Đọc và phân tích yêu cầu

## 1. Business Context

Công ty ABC là doanh nghiệp cung cấp dịch vụ đặt xe trực tuyến. Hiện tại khách hàng có thể liên hệ với tổng đài hoặc sử dụng một ứng dụng đơn giản để yêu cầu xe.

Ban lãnh đạo ABC mong muốn xây dựng một nền tảng CAB mới có khả năng phục vụ số lượng lớn khách hàng và tài xế, đồng thời có khả năng phát triển thêm các tính năng trong tương lai.

Hệ thống mới không chỉ phục vụ chức năng đặt xe mà phải hỗ trợ xuyên suốt quy trình nghiệp vụ từ khi khách hàng tạo yêu cầu, tìm và phân công tài xế, thực hiện chuyến đi, tính cước, thanh toán, thông báo đến đánh giá sau chuyến. Các bộ phận trong doanh nghiệp cũng cần có khả năng phối hợp thông qua hệ thống và có đủ dữ liệu để theo dõi hoạt động.

---

## 2. Ngữ cảnh nghiệp vụ (Business Context)

### 2.1. Quy trình nghiệp vụ tổng quát

Quy trình nghiệp vụ chính của CAB System được xác định ở mức tổng quát như sau:

```text
Khách hàng tạo yêu cầu đặt xe
        ↓
Hệ thống tiếp nhận yêu cầu
        ↓
Xác định tài xế phù hợp
        ↓
Đề xuất chuyến cho tài xế
        ↓
Tài xế chấp nhận / từ chối / không phản hồi
        ↓
Nếu không nhận → tiếp tục tìm tài xế khác
        ↓
Tài xế đến điểm đón
        ↓
Đón khách
        ↓
Đang di chuyển
        ↓
Hoàn thành chuyến
        ↓
Tính cước
        ↓
Thanh toán
        ↓
Khách hàng đánh giá tài xế
```

Trong quá trình này, hệ thống phải hỗ trợ:

- Theo dõi trạng thái của yêu cầu và chuyến đi.
- Lưu thông tin vị trí tài xế để hỗ trợ tìm tài xế gần khách hàng và cải thiện khả năng dự kiến thời gian đến.
- Gửi thông báo cho khách hàng và tài xế tại các mốc quan trọng.
- Xử lý trường hợp tài xế từ chối hoặc không phản hồi.
- Xử lý thanh toán tiền mặt và thanh toán điện tử.
- Quản lý lịch sử chuyến đi và giao dịch.
- Hỗ trợ nhân viên vận hành quản lý và xử lý các trường hợp bất thường.
- Cung cấp báo cáo phục vụ theo dõi hoạt động kinh doanh.

---

## 3. Business Problem

### BP01. Phân công tài xế còn phụ thuộc vào thao tác thủ công

Việc phân công tài xế hiện tại chủ yếu được thực hiện thủ công.

Điều này gây khó khăn khi số lượng khách hàng và tài xế tăng lên, đồng thời làm tăng áp lực cho bộ phận vận hành.

**Tác động nghiệp vụ:**

- Khó đáp ứng số lượng yêu cầu lớn.
- Khó duy trì hiệu quả vận hành khi quy mô tăng.
- Việc tìm tài xế chưa được tự động hóa đầy đủ.

---

### BP02. Khách hàng khó theo dõi trạng thái chuyến đi

Khách hàng hiện khó theo dõi đầy đủ trạng thái của yêu cầu và chuyến đi.

Khách hàng cần biết:

- Hệ thống đang tìm tài xế hay chưa.
- Tài xế nào đã nhận chuyến.
- Thời gian dự kiến tài xế đến.
- Trạng thái hiện tại của chuyến đi.

**Tác động nghiệp vụ:**

- Khách hàng thiếu thông tin trong quá trình sử dụng dịch vụ.
- Giảm khả năng chủ động theo dõi chuyến đi.
- Ảnh hưởng đến trải nghiệm khách hàng.

---

### BP03. Thông tin thanh toán chưa được quản lý tập trung

Thông tin thanh toán hiện tại chưa được quản lý tập trung.

Trong khi đó, hệ thống mới phải hỗ trợ:

- Thanh toán bằng tiền mặt.
- Thanh toán điện tử.
- Tích hợp với nhà cung cấp thanh toán bên ngoài.
- Không lưu trực tiếp thông tin nhạy cảm của thẻ hoặc tài khoản thanh toán trong hệ thống CAB.

**Tác động nghiệp vụ:**

- Khó quản lý giao dịch theo một quy trình thống nhất.
- Khó kiểm soát kết quả thanh toán.
- Cần cơ chế xử lý khi thanh toán điện tử thất bại.

---

### BP04. Hệ thống hiện tại khó mở rộng

Doanh nghiệp muốn hệ thống mới có thể phục vụ số lượng lớn khách hàng và tài xế, đồng thời có thể phát triển thêm các tính năng trong tương lai.

Các nhu cầu mở rộng được đề cập gồm:

- Thêm loại dịch vụ mới.
- Thêm phương thức thanh toán.
- Thêm nhà cung cấp thông báo.
- Thay đổi một số thành phần kỹ thuật mà không phải xây dựng lại toàn bộ ứng dụng.

**Tác động nghiệp vụ:**

- Hệ thống hiện tại không đáp ứng tốt mục tiêu phát triển dài hạn.
- Việc mở rộng quy mô và chức năng gặp khó khăn.
- Tăng rủi ro ảnh hưởng đến các chức năng đang hoạt động khi có thay đổi.

---

### BP05. Khả năng mở rộng và vận hành độc lập của các thành phần chưa đáp ứng

Doanh nghiệp yêu cầu hệ thống phải hoạt động ổn định trong các thời điểm nhu cầu tăng cao.

Đồng thời:

- Một lỗi ở thanh toán hoặc thông báo không được làm cho toàn bộ hệ thống đặt xe ngừng hoạt động.
- Các thành phần cần có khả năng mở rộng độc lập khi tải tăng.
- Các chức năng mới cần có khả năng triển khai từng phần với mức ảnh hưởng hạn chế đến các chức năng đang hoạt động.

**Tác động nghiệp vụ:**

- Giảm nguy cơ gián đoạn toàn bộ dịch vụ.
- Tăng khả năng duy trì hoạt động khi tải tăng.
- Hỗ trợ phát triển hệ thống theo từng giai đoạn.

---

### BP06. Khả năng hỗ trợ vận hành và quản lý chưa đáp ứng nhu cầu

Doanh nghiệp cần một giao diện quản trị để nhân viên vận hành có thể:

- Quản lý khách hàng.
- Quản lý tài xế.
- Quản lý phương tiện.
- Quản lý chuyến đi.
- Theo dõi các chuyến đang diễn ra.
- Kiểm tra trạng thái tài xế.
- Hỗ trợ xử lý các trường hợp chuyến bị lỗi.
- Tra cứu lịch sử giao dịch.

Một số chức năng quản trị cần được phân quyền để nhân viên thông thường không thể thực hiện các thao tác nhạy cảm.

**Tác động nghiệp vụ:**

- Cần tăng khả năng kiểm soát và hỗ trợ vận hành.
- Cần bảo đảm các thao tác nhạy cảm được kiểm soát theo quyền.
- Cần có dữ liệu để phục vụ kiểm tra và xử lý sự cố.

---

## 4. Vì sao hệ thống hiện tại không đáp ứng mục tiêu kinh doanh?

| Hạn chế hiện tại | Mục tiêu kinh doanh bị ảnh hưởng |
|---|---|
| Phân công tài xế chủ yếu thủ công | Khó phục vụ số lượng yêu cầu lớn và khó mở rộng vận hành |
| Khách hàng khó theo dõi chuyến | Khả năng phục vụ và trải nghiệm khách hàng chưa đáp ứng tốt |
| Thanh toán chưa được quản lý tập trung | Khó quản lý và kiểm soát giao dịch thống nhất |
| Khó mở rộng hệ thống | Hạn chế khả năng tăng trưởng và phát triển sản phẩm |
| Nhu cầu thông báo ngày càng đa dạng | Khó mở rộng các kênh giao tiếp với khách hàng và tài xế |
| Xử lý lỗi có nguy cơ ảnh hưởng hoạt động chung | Tăng rủi ro gián đoạn dịch vụ |
| Hỗ trợ vận hành và phân quyền cần được tăng cường | Khó quản lý và xử lý sự cố hiệu quả |

---

## 5. Mục tiêu kinh doanh (Business Goals)

Hệ thống CAB mới hướng tới các mục tiêu sau:

1. Phục vụ được số lượng lớn khách hàng và tài xế.
2. Cải thiện và tự động hóa quy trình tìm và phân công tài xế.
3. Cải thiện khả năng theo dõi chuyến đi của khách hàng.
4. Hỗ trợ tính cước và thanh toán theo quy trình thống nhất.
5. Hỗ trợ nhân viên vận hành quản lý khách hàng, tài xế, phương tiện và chuyến đi.
6. Hỗ trợ xử lý các trường hợp bất thường và sự cố trong quá trình vận hành.
7. Cung cấp dữ liệu và báo cáo về hoạt động kinh doanh.
8. Bảo đảm hệ thống hoạt động ổn định trong thời điểm nhu cầu tăng cao.
9. Bảo vệ thông tin cá nhân, thông tin phương tiện, dữ liệu vị trí và dữ liệu giao dịch.
10. Xây dựng nền tảng đủ linh hoạt để bổ sung dịch vụ, phương thức thanh toán, nhà cung cấp thông báo và các thành phần kỹ thuật mới trong tương lai.

---

## 6. Giá trị nghiệp vụ của hệ thống mới (Business Value)

### 6.1. Tự động hóa quy trình tìm và phân công tài xế

Hệ thống mới hỗ trợ xác định tài xế phù hợp dựa trên vị trí, trạng thái sẵn sàng và các tiêu chí vận hành khác.

Khi tài xế được đề xuất không phản hồi hoặc từ chối, hệ thống có thể tiếp tục tìm tài xế khác mà không yêu cầu khách hàng tạo lại yêu cầu.

**Giá trị:**

- Giảm sự phụ thuộc vào thao tác thủ công.
- Hỗ trợ xử lý yêu cầu hiệu quả hơn.
- Tăng khả năng mở rộng khi số lượng yêu cầu tăng.

---

### 6.2. Cải thiện trải nghiệm khách hàng

Khách hàng có thể:

- Theo dõi trạng thái yêu cầu.
- Biết tài xế nào đã nhận chuyến.
- Biết thời gian dự kiến tài xế đến.
- Theo dõi trạng thái chuyến.
- Xem lịch sử chuyến đi.
- Xem số tiền phải trả.
- Đánh giá tài xế sau chuyến.

**Giá trị:**

- Tăng khả năng quan sát của khách hàng.
- Giảm sự không rõ ràng trong quá trình chờ và thực hiện chuyến.
- Cải thiện trải nghiệm sử dụng dịch vụ.

---

### 6.3. Nâng cao hiệu quả vận hành

Nhân viên vận hành có thể quản lý khách hàng, tài xế, phương tiện và chuyến đi trên một giao diện quản trị.

Hệ thống cũng hỗ trợ:

- Theo dõi các chuyến đang diễn ra.
- Kiểm tra trạng thái tài xế.
- Hỗ trợ xử lý các trường hợp chuyến bị lỗi.
- Tra cứu lịch sử giao dịch.

**Giá trị:**

- Tăng khả năng kiểm soát hoạt động.
- Hỗ trợ xử lý sự cố.
- Tạo dữ liệu tập trung phục vụ vận hành.

---

### 6.4. Nâng cao khả năng quản lý thanh toán

Hệ thống mới hỗ trợ cả thanh toán tiền mặt và thanh toán điện tử.

Đối với thanh toán điện tử, hệ thống tích hợp với nhà cung cấp thanh toán bên ngoài và không lưu trực tiếp dữ liệu nhạy cảm của thẻ hoặc tài khoản thanh toán.

Khi giao dịch thất bại, hệ thống phải thông báo cho khách hàng và cho phép xử lý lại theo chính sách của doanh nghiệp.

**Giá trị:**

- Hỗ trợ nhiều phương thức thanh toán.
- Tăng khả năng kiểm soát kết quả giao dịch.
- Giảm rủi ro khi quản lý dữ liệu thanh toán nhạy cảm.

---

### 6.5. Cải thiện khả năng thông báo

Khách hàng cần nhận được thông báo khi:

- Yêu cầu đặt xe được tiếp nhận.
- Tài xế nhận chuyến.
- Tài xế đến điểm đón.
- Chuyến hoàn thành.
- Thanh toán có kết quả.

Tài xế cũng cần nhận thông báo về chuyến mới hoặc thay đổi liên quan đến chuyến đang thực hiện.

**Giá trị:**

- Cải thiện khả năng giao tiếp giữa hệ thống và người dùng.
- Tăng tính minh bạch của quy trình nghiệp vụ.
- Tạo nền tảng để mở rộng thêm các kênh thông báo trong tương lai.

---

### 6.6. Hỗ trợ báo cáo và ra quyết định

Ban lãnh đạo cần có báo cáo về:

- Số lượng chuyến.
- Doanh thu.
- Tỷ lệ chuyến hoàn thành.
- Tỷ lệ hủy.
- Hiệu quả hoạt động của tài xế.

**Giá trị:**

- Giúp doanh nghiệp theo dõi hiệu quả hoạt động.
- Hỗ trợ đánh giá tình hình kinh doanh.
- Hỗ trợ ra quyết định dựa trên dữ liệu.

---

### 6.7. Tăng khả năng mở rộng và phát triển dài hạn

Hệ thống mới phải có khả năng:

- Mở rộng các thành phần độc lập khi tải tăng.
- Triển khai chức năng mới từng phần.
- Hạn chế ảnh hưởng đến các chức năng đang hoạt động.
- Bổ sung loại dịch vụ mới.
- Bổ sung phương thức thanh toán mới.
- Bổ sung nhà cung cấp thông báo mới.
- Thay đổi một số thành phần kỹ thuật mà không phải xây dựng lại toàn bộ ứng dụng.

**Giá trị:**

- Phù hợp với mục tiêu phát triển lâu dài.
- Giảm phụ thuộc vào việc xây dựng lại toàn bộ hệ thống khi có thay đổi.
- Hỗ trợ doanh nghiệp mở rộng sản phẩm theo từng giai đoạn.

---

## 7. So sánh hệ thống hiện tại và hệ thống mới

| Khía cạnh | Hệ thống hiện tại | Hệ thống CAB mới |
|---|---|---|
| Yêu cầu đặt xe | Tổng đài hoặc ứng dụng đơn giản | Nền tảng CAB hỗ trợ toàn bộ quy trình |
| Phân công tài xế | Chủ yếu thủ công | Hỗ trợ tìm và phân công dựa trên vị trí, trạng thái và tiêu chí vận hành |
| Xử lý tài xế từ chối/không phản hồi | Chưa đáp ứng đầy đủ | Có cơ chế tiếp tục tìm tài xế khác |
| Theo dõi chuyến | Khó theo dõi | Theo dõi trạng thái chuyến, tài xế và thời gian dự kiến |
| Vị trí tài xế | Chưa đáp ứng nhu cầu mới | Lưu thông tin vị trí để hỗ trợ tìm tài xế và ước tính thời gian đến |
| Thanh toán | Thông tin chưa quản lý tập trung | Hỗ trợ tiền mặt và điện tử, tích hợp nhà cung cấp bên ngoài |
| Dữ liệu thanh toán nhạy cảm | Chưa đáp ứng yêu cầu mới | Không lưu trực tiếp thông tin nhạy cảm trong CAB |
| Thông báo | Còn hạn chế | Thông báo cho khách hàng và tài xế tại các sự kiện quan trọng |
| Quản trị | Hạn chế | Giao diện quản trị cho nhân viên vận hành |
| Phân quyền | Chưa đáp ứng đầy đủ | Kiểm soát quyền đối với thao tác quản trị nhạy cảm |
| Báo cáo | Chưa đáp ứng đầy đủ | Báo cáo số chuyến, doanh thu, hoàn thành, hủy và hiệu quả tài xế |
| Khả năng mở rộng | Khó mở rộng | Có khả năng mở rộng độc lập các thành phần |
| Phát triển chức năng | Khó mở rộng dài hạn | Có thể bổ sung chức năng mới từng phần |
| Khả năng phát triển sản phẩm | Hạn chế | Hướng tới nền tảng CAB phát triển lâu dài |

---

## 8. Business Stakeholders / Business Contacts

Ở giai đoạn B1, tài liệu chưa cung cấp tên hoặc thông tin liên hệ cụ thể của từng cá nhân. Vì vậy chỉ xác định các nhóm stakeholder/business contact theo vai trò nghiệp vụ.

| Stakeholder / Business Contact | Mối quan tâm chính |
|---|---|
| Ban lãnh đạo ABC | Mục tiêu kinh doanh, khả năng mở rộng, báo cáo, doanh thu và hiệu quả hoạt động |
| Khách hàng | Đăng ký, đặt xe, theo dõi chuyến, thanh toán, lịch sử và đánh giá |
| Tài xế | Hồ sơ, phương tiện, trạng thái hoạt động, nhận chuyến và cập nhật trạng thái chuyến |
| Nhân viên vận hành | Quản lý khách hàng, tài xế, phương tiện, chuyến đi, trạng thái và sự cố |
| Nhà cung cấp thanh toán bên ngoài | Xử lý giao dịch thanh toán điện tử |
| Nhà cung cấp dịch vụ thông báo | Cung cấp các kênh gửi thông báo |

---

## 9. Ràng buộc (Constraints)

### 9.1. Ràng buộc về thời gian

- Thời gian xây dựng và triển khai sản phẩm: **7 tuần**.

Ràng buộc này ảnh hưởng trực tiếp đến việc xác định phạm vi, mức độ ưu tiên và kế hoạch triển khai các chức năng.

### 9.2. Ràng buộc về thanh toán

- Phải tích hợp với nhà cung cấp thanh toán bên ngoài.
- Không lưu trực tiếp thông tin nhạy cảm của thẻ hoặc tài khoản thanh toán trong hệ thống CAB.
- Phải có cơ chế thông báo và xử lý lại khi thanh toán điện tử thất bại theo chính sách doanh nghiệp.

### 9.3. Ràng buộc về khả năng mở rộng

- Hệ thống phải có khả năng phục vụ số lượng lớn khách hàng và tài xế.
- Các thành phần phải có khả năng mở rộng độc lập khi tải tăng.
- Chức năng mới cần có khả năng triển khai từng phần.

### 9.4. Ràng buộc về bảo mật

- Khách hàng và tài xế phải được xác thực trước khi sử dụng các chức năng yêu cầu tài khoản.
- Các thao tác quản trị phải được kiểm soát quyền truy cập.
- Thông tin cá nhân phải được bảo vệ.
- Thông tin phương tiện phải được bảo vệ.
- Dữ liệu vị trí phải được bảo vệ.
- Dữ liệu giao dịch phải được bảo vệ.
- Các thao tác quan trọng phải được lưu vết để phục vụ kiểm tra khi có sự cố.

### 9.5. Ràng buộc về độ ổn định

- Hệ thống phải hoạt động ổn định vào thời điểm nhu cầu tăng cao.
- Lỗi ở chức năng thanh toán hoặc thông báo không được làm toàn bộ hệ thống đặt xe ngừng hoạt động.

---

## 10. Các yêu cầu nghiệp vụ còn chưa rõ (Open Issues)

Đây là các nội dung khách hàng chưa chốt và cần BA làm rõ với các bên liên quan trước khi nhóm phát triển xây dựng giải pháp.

| ID | Vấn đề cần xác nhận | Ảnh hưởng đến |
|---|---|---|
| OI01 | Cách tính cước | Pricing, chuyến đi, thanh toán |
| OI02 | Tiêu chí ưu tiên tài xế | Tìm và phân công tài xế |
| OI03 | Thời gian tài xế phải phản hồi | Matching và xử lý timeout |
| OI04 | Chính sách hủy chuyến | Quy trình chuyến và tính cước |
| OI05 | Cách xử lý khi mất kết nối mạng | Trạng thái và tính liên tục của chuyến |
| OI06 | Thời gian lưu trữ dữ liệu | Data management và lịch sử |
| OI07 | Chính sách xử lý thanh toán thất bại | Payment và retry |
| OI08 | Cách thông báo khi không tìm được tài xế | Customer experience |
| OI09 | Phân quyền chi tiết giữa các loại nhân viên vận hành | Authorization |
| OI10 | Chi tiết các chỉ số và báo cáo cần cung cấp | Reporting |
| OI11 | Chính sách cụ thể đối với dữ liệu vị trí tài xế | Location tracking và data protection |
| OI12 | Các chính sách vận hành khác khi nhu cầu tăng cao | Scalability và operations |

---

## 11. Rủi ro nghiệp vụ cần lưu ý

### Risk 01. Không thống nhất được business rules

Các quy tắc như tính cước, ưu tiên tài xế, timeout và hủy chuyến chưa được xác định rõ có thể làm thay đổi quy trình nghiệp vụ và yêu cầu hệ thống ở các bước sau.

### Risk 02. Phạm vi lớn trong thời gian 7 tuần

Dự án phải xây dựng và triển khai trong 7 tuần trong khi phạm vi bao gồm đặt xe, matching, chuyến đi, thanh toán, thông báo, quản trị, báo cáo, bảo mật và khả năng mở rộng.

Do đó cần xác định rõ phạm vi ưu tiên cho giai đoạn đầu.

### Risk 03. Phụ thuộc vào hệ thống bên ngoài

Thanh toán điện tử phụ thuộc vào nhà cung cấp thanh toán bên ngoài. Ngoài ra, hệ thống có định hướng mở rộng thêm các nhà cung cấp thông báo trong tương lai.

### Risk 04. Tăng tải vào giờ cao điểm

Nhu cầu tăng cao có thể ảnh hưởng đến khả năng phục vụ nếu các thành phần không được thiết kế để mở rộng phù hợp.

### Risk 05. Lỗi ở một thành phần ảnh hưởng đến hoạt động

Lỗi ở thanh toán hoặc thông báo không được phép làm toàn bộ hệ thống đặt xe dừng hoạt động.

### Risk 06. Rủi ro về bảo mật và dữ liệu

Hệ thống xử lý thông tin cá nhân, thông tin phương tiện, dữ liệu vị trí và dữ liệu giao dịch nên cần kiểm soát quyền truy cập, bảo vệ dữ liệu và lưu vết thao tác quan trọng.

---

## 12. Kết luận Bước 1

ABC cần xây dựng một nền tảng CAB mới để giải quyết các hạn chế của hệ thống hiện tại, đặc biệt là:

- Phân công tài xế còn phụ thuộc vào thao tác thủ công.
- Khách hàng khó theo dõi trạng thái chuyến đi.
- Thông tin thanh toán chưa được quản lý tập trung.
- Hệ thống khó mở rộng theo nhu cầu tăng trưởng.
- Khả năng hỗ trợ vận hành, thông báo, báo cáo và kiểm soát hệ thống cần được nâng cao.

Giá trị của hệ thống mới không chỉ nằm ở việc cung cấp chức năng đặt xe mà còn ở việc tạo ra một nền tảng hỗ trợ toàn bộ vòng đời chuyến đi, nâng cao hiệu quả vận hành, cải thiện trải nghiệm khách hàng, hỗ trợ quản lý dữ liệu và báo cáo, đồng thời tạo nền tảng cho việc mở rộng sản phẩm trong tương lai.

Bên cạnh đó, một số business rule và chính sách quan trọng vẫn chưa được xác định, đặc biệt là cách tính cước, tiêu chí ưu tiên tài xế, thời gian phản hồi, chính sách hủy chuyến, xử lý mất kết nối và thời gian lưu trữ dữ liệu. Đây là các nội dung BA cần tiếp tục làm rõ với stakeholder trước khi đặc tả chi tiết ở các bước tiếp theo.

---

## 13. Định hướng cho các bước phân tích tiếp theo

Kết quả của B1 là cơ sở để tiếp tục xác định:

1. **Scope của hệ thống**
2. **Actors và Stakeholders chi tiết**
3. **Business Process**
4. **Functional Requirements**
5. **Non-functional Requirements**
6. **Business Rules**
7. **Use Cases**
8. **Exception / Alternative Flows**
9. **Các câu hỏi cần xác nhận với khách hàng**
10. **Các yêu cầu ưu tiên trong phạm vi triển khai 7 tuần**

