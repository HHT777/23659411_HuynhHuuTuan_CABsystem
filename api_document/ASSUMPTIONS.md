# Giả định khi đặc tả API

SRS chốt tên DTO tại mục 12.1 nhưng không có data dictionary riêng cho DTO. Các entity tại mục 9 được giữ nguyên tên field; những cấu trúc vận chuyển dưới đây được đánh dấu `x-assumption: true` trong YAML.

| Phạm vi | Giả định tối thiểu | Lý do / nguồn SRS |
| --- | --- | --- |
| API-01–30, các DTO request/response | Trường DTO được chọn từ entity liên quan và tiền/hậu điều kiện UC; không coi DTO là entity mới. | Mục 9, 10 và 12.1 chỉ nêu tên DTO, không nêu đầy đủ field. |
| API-01/02/03/08, `password` | Giới hạn trên 128 ký tự; giới hạn dưới và pattern chữ+số theo DEC-29. | DEC-29 không nêu độ dài tối đa của mật khẩu thô. |
| API-03/04, `AuthTokens` | Trả `accessToken`, `refreshToken`, `tokenType`, `expiresIn`; token tối thiểu 20 ký tự. | UC-02 nêu cấp access/refresh token nhưng không chốt hình dạng và TTL. |
| API-23, `X-Signature` | Header có dạng `sha256=<hex>` và tối thiểu 32 ký tự. | DEC-27 chốt HMAC nhưng không chốt tên header, thuật toán/encoding hay canonical payload. |
| API-24/27, phân trang | Mặc định `page=1`, `size=20`; ngưỡng 1..1000 và 1..100 lấy từ BC-12. | BC-12 chốt biên nhưng không chốt giá trị mặc định. |
| API-24/27, page response | Dùng wrapper `items`, `page`, `size`, `total`; active trips dùng `items`, `asOf`. | Tên response có hậu tố `Page` nhưng SRS không nêu cấu trúc wrapper. |
| API-25, `NotificationPatch` | Chỉ hỗ trợ `read=true` cùng `version`. | UC-13.3 chỉ nêu đánh dấu READ, không nêu payload. |
| API-26, SSE | Event dùng các dòng `id`, `event`, `data`; `data` là JSON. | SRS chốt SSE, `Last-Event-ID` và reconnect nhưng không chốt wire format chi tiết. |
| API-29, `IncidentUpdate.resolution` | Tập tối thiểu `CONTINUE_TRIP`, `CANCEL_TRIP`, `TERMINATE_TRIP`, `FARE_REVIEW`. | DEC-20–22 mô tả các kết quả nhưng mục 9 chỉ ghi kiểu `enum`. |
| API-30, `Report` | Một response tổng hợp chứa count, revenue, rates, rating và `asOf`; thời gian ISO-8601 có offset. | DEC-31 chốt công thức/mốc thời gian nhưng không chốt JSON envelope. |
| Mã lỗi `Error.code` | Dùng mã tiếng Anh ổn định theo response component, ví dụ `VERSION_CONFLICT`. | SRS chốt HTTP status/điều kiện nhưng không cung cấp catalog chuỗi code đầy đủ. |
