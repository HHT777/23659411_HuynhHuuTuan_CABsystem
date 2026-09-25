from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "api-document"


def prop(kind, description, example, **kwargs):
    value = {"type": kind, "description": description, "example": example}
    value.update(kwargs)
    return value


def obj(description, properties, required=(), example=None):
    value = {
        "type": "object",
        "description": description,
        "properties": properties,
    }
    if required:
        value["required"] = list(required)
    if example is not None:
        value["example"] = example
    return value


def array(description, items, example):
    return {
        "type": "array",
        "description": description,
        "items": items,
        "example": example,
    }


def ref(section, name):
    return {"$ref": f"#/components/{section}/{name}"}


def ref_prop(name, description, example):
    return {
        "type": "object",
        "description": description,
        "example": example,
        "allOf": [ref("schemas", name)],
    }


def json_response(description, schema, example=None):
    response = {
        "description": description,
        "content": {"application/json": {"schema": schema}},
    }
    if example is not None:
        response["content"]["application/json"]["example"] = example
    return response


def request(schema_name, example, description="Dữ liệu yêu cầu."):
    return {
        "required": True,
        "description": description,
        "content": {
            "application/json": {
                "schema": ref("schemas", schema_name),
                "example": example,
            }
        },
    }


def operation(tag, operation_id, summary, description, srs_ref, roles, responses, **kwargs):
    value = {
        "tags": [tag],
        "operationId": operation_id,
        "summary": summary,
        "description": description,
        "x-srs-ref": srs_ref,
        "x-roles": roles,
        "responses": responses,
    }
    value.update(kwargs)
    return value


def error_responses(*codes):
    names = {
        "400": "BadRequest",
        "401": "Unauthorized",
        "403": "Forbidden",
        "404": "NotFound",
        "409": "Conflict",
        "422": "UnprocessableEntity",
        "429": "TooManyRequests",
        "500": "InternalServerError",
        "502": "BadGateway",
    }
    return {code: ref("responses", names[code]) for code in codes}


UUID = {"format": "uuid", "pattern": "^[0-9a-fA-F-]{36}$"}
PHONE = {"minLength": 9, "maxLength": 15, "pattern": "^\\+?[0-9]{9,15}$"}
DATE_TIME = {"format": "date-time"}
MONEY = {"format": "double", "minimum": 0}


def build_schemas():
    coordinate = obj(
        "Tọa độ WGS84.",
        {
            "latitude": prop("number", "Vĩ độ WGS84.", 10.7769, format="double", minimum=-90, maximum=90),
            "longitude": prop("number", "Kinh độ WGS84.", 106.7009, format="double", minimum=-180, maximum=180),
            "address": prop("string", "Địa chỉ hiển thị.", "1 Lê Duẩn, Quận 1, TP.HCM", minLength=1, maxLength=255),
        },
        ("latitude", "longitude", "address"),
    )
    schemas = {
        "ErrorDetail": obj(
            "Chi tiết lỗi tại một trường dữ liệu.",
            {
                "field": prop("string", "Tên trường gây lỗi.", "phone", minLength=1, maxLength=100),
                "reason": prop("string", "Nguyên nhân trường không hợp lệ.", "Số điện thoại đã tồn tại.", minLength=1, maxLength=500),
            },
            ("field", "reason"),
        ),
        "ErrorResponse": obj(
            "Định dạng lỗi thống nhất của API.",
            {
                "code": prop("string", "Mã lỗi ổn định cho máy khách.", "PHONE_ALREADY_EXISTS", minLength=1, maxLength=100),
                "message": prop("string", "Thông báo lỗi dễ đọc.", "Không thể xử lý yêu cầu.", minLength=1, maxLength=500),
                "details": array("Danh sách chi tiết lỗi.", ref("schemas", "ErrorDetail"), [{"field": "phone", "reason": "Số điện thoại đã tồn tại."}]),
                "requestId": prop("string", "Mã truy vết yêu cầu.", "req_01J8QH8Y7W", minLength=1, maxLength=100),
            },
            ("code", "message", "details", "requestId"),
        ),
        "PaginationMeta": obj(
            "Thông tin phân trang.",
            {
                "page": prop("integer", "Trang hiện tại, bắt đầu từ 1.", 1, format="int32", minimum=1, maximum=1000),
                "size": prop("integer", "Số phần tử mỗi trang.", 20, format="int32", minimum=1, maximum=100),
                "totalItems": prop("integer", "Tổng số phần tử.", 42, format="int64", minimum=0),
                "totalPages": prop("integer", "Tổng số trang.", 3, format="int32", minimum=0),
            },
            ("page", "size", "totalItems", "totalPages"),
        ),
        "PaginatedResponse": obj(
            "Khung phản hồi phân trang dùng lại.",
            {
                "data": array("Danh sách dữ liệu của trang.", {"type": "object", "description": "Một phần tử kết quả.", "example": {"id": "550e8400-e29b-41d4-a716-446655440000"}}, [{"id": "550e8400-e29b-41d4-a716-446655440000"}]),
                "pagination": ref_prop("PaginationMeta", "Metadata phân trang.", {"page": 1, "size": 20, "totalItems": 42, "totalPages": 3}),
            },
            ("data", "pagination"),
        ),
        "Coordinate": coordinate,
        "UserCreateRequest": obj(
            "Thông tin đăng ký khách hàng.",
            {
                "phone": prop("string", "Số điện thoại duy nhất của tài khoản.", "+84901234567", **PHONE),
                "name": prop("string", "Tên hiển thị của khách hàng.", "Nguyễn Văn An", minLength=2, maxLength=100),
                "password": prop("string", "Mật khẩu tài khoản; không được ghi log.", "Cab@123456", format="password", minLength=8, maxLength=72),
            },
            ("phone", "name", "password"),
        ),
        "LoginRequest": obj(
            "Thông tin đăng nhập.",
            {
                "phone": prop("string", "Số điện thoại tài khoản.", "+84901234567", **PHONE),
                "password": prop("string", "Mật khẩu tài khoản.", "Cab@123456", format="password", minLength=8, maxLength=72),
            },
            ("phone", "password"),
        ),
        "TokenRefreshRequest": obj(
            "Yêu cầu cấp lại access token.",
            {"refreshToken": prop("string", "Refresh token còn hiệu lực.", "eyJhbGciOiJIUzI1NiJ9.refresh", minLength=20, maxLength=4096)},
            ("refreshToken",),
        ),
        "AuthTokensResponse": obj(
            "Cặp token xác thực; refresh token được xoay vòng khi làm mới.",
            {
                "accessToken": prop("string", "JWT access token có hiệu lực 30 phút.", "eyJhbGciOiJIUzI1NiJ9.access", minLength=20, maxLength=4096),
                "refreshToken": prop("string", "Refresh token có hiệu lực 7 ngày.", "eyJhbGciOiJIUzI1NiJ9.refresh", minLength=20, maxLength=4096),
                "tokenType": prop("string", "Loại token dùng ở Authorization header.", "Bearer", enum=["Bearer"]),
                "expiresIn": prop("integer", "Thời hạn access token tính bằng giây.", 1800, format="int32", minimum=1, maximum=1800),
            },
            ("accessToken", "refreshToken", "tokenType", "expiresIn"),
        ),
        "UserResponse": obj(
            "Thông tin tài khoản trả về cho máy khách.",
            {
                "id": prop("string", "Định danh tài khoản.", "550e8400-e29b-41d4-a716-446655440000", **UUID),
                "phone": prop("string", "Số điện thoại tài khoản.", "+84901234567", **PHONE),
                "name": prop("string", "Tên hiển thị.", "Nguyễn Văn An", minLength=2, maxLength=100),
                "role": prop("string", "Vai trò chính.", "CUSTOMER", enum=["CUSTOMER", "DRIVER", "OPERATOR", "ADMIN", "EXECUTIVE"]),
                "createdAt": prop("string", "Thời điểm tạo tài khoản.", "2026-09-24T10:00:00+07:00", **DATE_TIME),
            },
            ("id", "phone", "name", "role", "createdAt"),
        ),
        "ProfileUpdateRequest": obj(
            "Các trường hồ sơ khách hàng được phép cập nhật.",
            {
                "name": prop("string", "Tên hiển thị mới.", "Nguyễn Văn Bình", minLength=2, maxLength=100),
                "phone": prop("string", "Số điện thoại mới, phải duy nhất.", "+84987654321", **PHONE),
            },
            (),
        ),
        "DriverAvailabilityRequest": obj(
            "Trạng thái sẵn sàng nhận chuyến.",
            {"availability": prop("string", "ONLINE chỉ hợp lệ khi hồ sơ và xe hoạt động, tài xế không có chuyến mở.", "ONLINE", enum=["ONLINE", "OFFLINE"])},
            ("availability",),
        ),
        "VehicleResponse": obj(
            "Thông tin phương tiện.",
            {
                "id": prop("string", "Định danh phương tiện.", "650e8400-e29b-41d4-a716-446655440000", **UUID),
                "licensePlate": prop("string", "Biển số xe.", "59A1-123.45", minLength=5, maxLength=20, pattern="^[A-Za-z0-9.-]{5,20}$"),
                "vehicleType": prop("string", "Loại phương tiện trong pilot.", "MOTORCYCLE", enum=["MOTORCYCLE", "CAR_4"]),
                "status": prop("string", "Trạng thái vận hành của xe.", "ACTIVE", enum=["ACTIVE", "INACTIVE"]),
            },
            ("id", "licensePlate", "vehicleType", "status"),
        ),
        "DriverResponse": obj(
            "Thông tin vận hành của tài xế.",
            {
                "id": prop("string", "Định danh tài xế.", "750e8400-e29b-41d4-a716-446655440000", **UUID),
                "name": prop("string", "Tên tài xế.", "Trần Minh Khoa", minLength=2, maxLength=100),
                "phone": prop("string", "Số điện thoại tài xế.", "+84905551234", **PHONE),
                "status": prop("string", "Trạng thái hồ sơ tài xế.", "ACTIVE", enum=["ACTIVE", "SUSPENDED"]),
                "availability": prop("string", "Trạng thái nhận chuyến.", "ONLINE", enum=["ONLINE", "OFFLINE"]),
                "vehicle": ref_prop("VehicleResponse", "Phương tiện hiện tại của tài xế.", {"id": "650e8400-e29b-41d4-a716-446655440000", "licensePlate": "59A1-123.45", "vehicleType": "MOTORCYCLE", "status": "ACTIVE"}),
            },
            ("id", "name", "phone", "status", "availability", "vehicle"),
        ),
        "RideRequestCreateRequest": obj(
            "Yêu cầu đặt chuyến mới.",
            {
                "pickup": ref_prop("Coordinate", "Điểm đón.", {"latitude": 10.7769, "longitude": 106.7009, "address": "1 Lê Duẩn, Quận 1, TP.HCM"}),
                "destination": ref_prop("Coordinate", "Điểm đến.", {"latitude": 10.8022, "longitude": 106.7145, "address": "Bình Thạnh, TP.HCM"}),
                "vehicleType": prop("string", "Loại xe mong muốn.", "MOTORCYCLE", enum=["MOTORCYCLE", "CAR_4"]),
            },
            ("pickup", "destination", "vehicleType"),
        ),
        "RideRequestResponse": obj(
            "Yêu cầu chuyến đã được ghi nhận.",
            {
                "id": prop("string", "Định danh yêu cầu chuyến.", "850e8400-e29b-41d4-a716-446655440000", **UUID),
                "customerId": prop("string", "Định danh khách hàng sở hữu.", "550e8400-e29b-41d4-a716-446655440000", **UUID),
                "pickup": ref_prop("Coordinate", "Điểm đón.", {"latitude": 10.7769, "longitude": 106.7009, "address": "1 Lê Duẩn, Quận 1, TP.HCM"}),
                "destination": ref_prop("Coordinate", "Điểm đến.", {"latitude": 10.8022, "longitude": 106.7145, "address": "Bình Thạnh, TP.HCM"}),
                "vehicleType": prop("string", "Loại xe yêu cầu.", "MOTORCYCLE", enum=["MOTORCYCLE", "CAR_4"]),
                "status": prop("string", "Trạng thái yêu cầu.", "SEARCHING", enum=["SEARCHING", "ASSIGNED", "NO_DRIVER_FOUND", "CANCELLED"]),
                "fareTableVersion": prop("string", "Phiên bản bảng giá được chốt khi tạo yêu cầu.", "fare-2026-01", minLength=1, maxLength=50),
                "createdAt": prop("string", "Thời điểm tạo yêu cầu.", "2026-09-24T10:05:00+07:00", **DATE_TIME),
            },
            ("id", "customerId", "pickup", "destination", "vehicleType", "status", "fareTableVersion", "createdAt"),
        ),
        "RideOfferResponse": obj(
            "Đề nghị chuyến dành cho tài xế.",
            {
                "id": prop("string", "Định danh đề nghị.", "950e8400-e29b-41d4-a716-446655440000", **UUID),
                "rideRequestId": prop("string", "Định danh yêu cầu chuyến.", "850e8400-e29b-41d4-a716-446655440000", **UUID),
                "pickup": ref_prop("Coordinate", "Điểm đón.", {"latitude": 10.7769, "longitude": 106.7009, "address": "1 Lê Duẩn, Quận 1, TP.HCM"}),
                "destination": ref_prop("Coordinate", "Điểm đến.", {"latitude": 10.8022, "longitude": 106.7145, "address": "Bình Thạnh, TP.HCM"}),
                "expiresAt": prop("string", "Thời điểm hết hạn; cửa sổ phản hồi 20 giây.", "2026-09-24T10:05:20+07:00", **DATE_TIME),
                "status": prop("string", "Trạng thái đề nghị.", "PENDING", enum=["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]),
            },
            ("id", "rideRequestId", "pickup", "destination", "expiresAt", "status"),
        ),
        "RideOfferDecisionRequest": obj(
            "Quyết định của tài xế với đề nghị chuyến.",
            {"decision": prop("string", "Chấp nhận hoặc từ chối đề nghị.", "ACCEPT", enum=["ACCEPT", "DECLINE"])},
            ("decision",),
        ),
        "DriverLocationRequest": obj(
            "Vị trí mới nhất của tài xế theo WGS84.",
            {
                "latitude": prop("number", "Vĩ độ WGS84.", 10.7769, format="double", minimum=-90, maximum=90),
                "longitude": prop("number", "Kinh độ WGS84.", 106.7009, format="double", minimum=-180, maximum=180),
            },
            ("latitude", "longitude"),
        ),
        "DriverLocationResponse": obj(
            "Vị trí tài xế đã lưu.",
            {
                "driverId": prop("string", "Định danh tài xế.", "750e8400-e29b-41d4-a716-446655440000", **UUID),
                "latitude": prop("number", "Vĩ độ WGS84.", 10.7769, format="double", minimum=-90, maximum=90),
                "longitude": prop("number", "Kinh độ WGS84.", 106.7009, format="double", minimum=-180, maximum=180),
                "updatedAt": prop("string", "Thời điểm cập nhật vị trí.", "2026-09-24T10:06:00+07:00", **DATE_TIME),
            },
            ("driverId", "latitude", "longitude", "updatedAt"),
        ),
        "TripStatusUpdateRequest": obj(
            "Trạng thái chuyến tiếp theo trong luồng hợp lệ.",
            {"status": prop("string", "Trạng thái mới.", "ARRIVED_AT_PICKUP", enum=["ARRIVED_AT_PICKUP", "PICKED_UP", "IN_PROGRESS", "COMPLETED"])},
            ("status",),
        ),
        "TripCancellationRequest": obj(
            "Thông tin hủy chuyến.",
            {"reason": prop("string", "Lý do hủy bắt buộc.", "Khách hàng thay đổi kế hoạch", minLength=3, maxLength=500)},
            ("reason",),
        ),
        "TripResponse": obj(
            "Thông tin chuyến đi.",
            {
                "id": prop("string", "Định danh chuyến.", "a50e8400-e29b-41d4-a716-446655440000", **UUID),
                "rideRequestId": prop("string", "Định danh yêu cầu gốc.", "850e8400-e29b-41d4-a716-446655440000", **UUID),
                "customerId": prop("string", "Định danh khách hàng.", "550e8400-e29b-41d4-a716-446655440000", **UUID),
                "driverId": prop("string", "Định danh tài xế.", "750e8400-e29b-41d4-a716-446655440000", **UUID),
                "status": prop("string", "Trạng thái chuyến.", "IN_PROGRESS", enum=["ASSIGNED", "ARRIVED_AT_PICKUP", "PICKED_UP", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
                "driverLocation": ref_prop("DriverLocationResponse", "Vị trí mới nhất của tài xế.", {"driverId": "750e8400-e29b-41d4-a716-446655440000", "latitude": 10.7769, "longitude": 106.7009, "updatedAt": "2026-09-24T10:06:00+07:00"}),
                "etaMinutes": prop("integer", "ETA theo phút; null khi không có dữ liệu định tuyến.", 8, format="int32", minimum=0, maximum=1440, nullable=True),
                "createdAt": prop("string", "Thời điểm tạo chuyến.", "2026-09-24T10:06:10+07:00", **DATE_TIME),
                "completedAt": prop("string", "Thời điểm hoàn thành, null nếu chưa hoàn thành.", "2026-09-24T10:36:10+07:00", nullable=True, **DATE_TIME),
            },
            ("id", "rideRequestId", "customerId", "driverId", "status", "createdAt"),
        ),
        "FareResponse": obj(
            "Cước phí được tính nội bộ sau khi hoàn thành chuyến.",
            {
                "id": prop("string", "Định danh bản ghi cước.", "b50e8400-e29b-41d4-a716-446655440000", **UUID),
                "tripId": prop("string", "Định danh chuyến.", "a50e8400-e29b-41d4-a716-446655440000", **UUID),
                "amount": prop("number", "Tổng cước đã làm tròn lên 1.000 VND.", 42000, **MONEY),
                "currency": prop("string", "Đơn vị tiền tệ.", "VND", enum=["VND"]),
                "fareTableVersion": prop("string", "Phiên bản bảng giá áp dụng.", "fare-2026-01", minLength=1, maxLength=50),
                "distanceKm": prop("number", "Quãng đường tính cước theo km.", 10.0, format="double", minimum=0),
            },
            ("id", "tripId", "amount", "currency", "fareTableVersion", "distanceKm"),
        ),
        "PaymentCreateRequest": obj(
            "Phương thức thanh toán cho chuyến đã hoàn thành.",
            {"method": prop("string", "Phương thức thanh toán.", "ELECTRONIC", enum=["CASH", "ELECTRONIC"])},
            ("method",),
        ),
        "PaymentResponse": obj(
            "Kết quả thanh toán không chứa dữ liệu thẻ hoặc tài khoản nhạy cảm.",
            {
                "id": prop("string", "Định danh thanh toán.", "c50e8400-e29b-41d4-a716-446655440000", **UUID),
                "tripId": prop("string", "Định danh chuyến.", "a50e8400-e29b-41d4-a716-446655440000", **UUID),
                "method": prop("string", "Phương thức thanh toán.", "ELECTRONIC", enum=["CASH", "ELECTRONIC"]),
                "status": prop("string", "Trạng thái thanh toán.", "PAID", enum=["PENDING", "PAID", "FAILED", "UNKNOWN"]),
                "amount": prop("number", "Số tiền thanh toán bằng VND.", 42000, **MONEY),
                "providerReference": prop("string", "Mã tham chiếu sandbox của nhà cung cấp.", "sandbox_txn_123", maxLength=100, nullable=True),
                "updatedAt": prop("string", "Thời điểm cập nhật gần nhất.", "2026-09-24T10:38:00+07:00", **DATE_TIME),
            },
            ("id", "tripId", "method", "status", "amount", "updatedAt"),
        ),
        "ProviderCallbackRequest": obj(
            "Callback từ nhà cung cấp thanh toán sandbox.",
            {
                "providerReference": prop("string", "Mã giao dịch phía nhà cung cấp.", "sandbox_txn_123", minLength=1, maxLength=100),
                "paymentId": prop("string", "Định danh thanh toán nội bộ.", "c50e8400-e29b-41d4-a716-446655440000", **UUID),
                "status": prop("string", "Kết quả tin cậy từ nhà cung cấp.", "PAID", enum=["PAID", "FAILED", "UNKNOWN"]),
                "occurredAt": prop("string", "Thời điểm phát sinh kết quả.", "2026-09-24T10:38:00+07:00", **DATE_TIME),
            },
            ("providerReference", "paymentId", "status", "occurredAt"),
        ),
        "CashConfirmationRequest": obj(
            "Xác nhận tài xế đã nhận tiền mặt.",
            {"received": prop("boolean", "Phải là true để xác nhận đã thu tiền.", True, enum=[True])},
            ("received",),
        ),
        "NotificationResponse": obj(
            "Thông báo in-app của người nhận.",
            {
                "id": prop("string", "Định danh thông báo.", "d50e8400-e29b-41d4-a716-446655440000", **UUID),
                "eventType": prop("string", "Loại sự kiện nghiệp vụ.", "DRIVER_ASSIGNED", enum=["REQUEST_RECEIVED", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "TRIP_COMPLETED", "TRIP_CANCELLED", "NO_DRIVER_FOUND", "PAYMENT_RESULT"]),
                "content": prop("string", "Nội dung thông báo.", "Đã tìm thấy tài xế cho chuyến đi.", minLength=1, maxLength=500),
                "read": prop("boolean", "Thông báo đã được đọc hay chưa.", False),
                "createdAt": prop("string", "Thời điểm tạo thông báo.", "2026-09-24T10:06:10+07:00", **DATE_TIME),
            },
            ("id", "eventType", "content", "read", "createdAt"),
        ),
        "NotificationUpdateRequest": obj(
            "Đánh dấu trạng thái đọc của thông báo.",
            {"read": prop("boolean", "Trạng thái đọc; pilot chỉ hỗ trợ đánh dấu đã đọc.", True, enum=[True])},
            ("read",),
        ),
        "RatingCreateRequest": obj(
            "Đánh giá tài xế trong 7 ngày kể từ khi chuyến hoàn thành.",
            {
                "score": prop("integer", "Điểm đánh giá nguyên từ 1 đến 5.", 5, format="int32", minimum=1, maximum=5),
                "comment": prop("string", "Nhận xét tùy chọn.", "Tài xế thân thiện và đúng giờ.", maxLength=500, nullable=True),
            },
            ("score",),
        ),
        "RatingResponse": obj(
            "Đánh giá đã ghi nhận.",
            {
                "id": prop("string", "Định danh đánh giá.", "e50e8400-e29b-41d4-a716-446655440000", **UUID),
                "tripId": prop("string", "Định danh chuyến.", "a50e8400-e29b-41d4-a716-446655440000", **UUID),
                "driverId": prop("string", "Định danh tài xế được đánh giá.", "750e8400-e29b-41d4-a716-446655440000", **UUID),
                "score": prop("integer", "Điểm đánh giá.", 5, format="int32", minimum=1, maximum=5),
                "comment": prop("string", "Nhận xét.", "Tài xế thân thiện và đúng giờ.", maxLength=500, nullable=True),
                "createdAt": prop("string", "Thời điểm đánh giá.", "2026-09-24T10:40:00+07:00", **DATE_TIME),
            },
            ("id", "tripId", "driverId", "score", "createdAt"),
        ),
        "OperationDriverUpdateRequest": obj(
            "Thay đổi trạng thái hồ sơ tài xế bởi vận hành.",
            {"status": prop("string", "Trạng thái mới của tài xế.", "SUSPENDED", enum=["ACTIVE", "SUSPENDED"])},
            ("status",),
        ),
        "RoleUpdateRequest": obj(
            "Cấp hoặc thu hồi vai trò vận hành.",
            {"role": prop("string", "Vai trò quản trị được phép cấu hình.", "OPERATOR", enum=["OPERATOR", "EXECUTIVE"])},
            ("role",),
        ),
        "FareTableCreateRequest": obj(
            "Bảng giá có phiên bản cho một loại xe.",
            {
                "version": prop("string", "Phiên bản bảng giá duy nhất.", "fare-2026-02", minLength=1, maxLength=50),
                "vehicleType": prop("string", "Loại xe áp dụng.", "MOTORCYCLE", enum=["MOTORCYCLE", "CAR_4"]),
                "openingFare": prop("number", "Giá mở cửa bằng VND.", 10000, **MONEY),
                "includedKm": prop("number", "Số km đã gồm trong giá mở cửa.", 2, format="double", minimum=0, maximum=100),
                "perKmFare": prop("number", "Đơn giá cho mỗi km tiếp theo.", 4000, **MONEY),
                "effectiveFrom": prop("string", "Thời điểm bảng giá có hiệu lực.", "2026-10-01T00:00:00+07:00", **DATE_TIME),
            },
            ("version", "vehicleType", "openingFare", "includedKm", "perKmFare", "effectiveFrom"),
        ),
        "FareTableResponse": obj(
            "Bảng giá đã được cấu hình.",
            {
                "id": prop("string", "Định danh bảng giá.", "f50e8400-e29b-41d4-a716-446655440000", **UUID),
                "version": prop("string", "Phiên bản bảng giá.", "fare-2026-02", minLength=1, maxLength=50),
                "vehicleType": prop("string", "Loại xe áp dụng.", "MOTORCYCLE", enum=["MOTORCYCLE", "CAR_4"]),
                "openingFare": prop("number", "Giá mở cửa bằng VND.", 10000, **MONEY),
                "includedKm": prop("number", "Số km đã gồm trong giá mở cửa.", 2, format="double", minimum=0),
                "perKmFare": prop("number", "Đơn giá mỗi km tiếp theo.", 4000, **MONEY),
                "effectiveFrom": prop("string", "Thời điểm có hiệu lực.", "2026-10-01T00:00:00+07:00", **DATE_TIME),
            },
            ("id", "version", "vehicleType", "openingFare", "includedKm", "perKmFare", "effectiveFrom"),
        ),
        "IncidentCreateRequest": obj(
            "Báo cáo sự cố từ khách hàng hoặc tài xế.",
            {
                "reason": prop("string", "Nhóm nguyên nhân sự cố.", "ROUTE", enum=["ROUTE", "DRIVER", "PASSENGER", "OTHER"]),
                "note": prop("string", "Mô tả bổ sung.", "Tuyến đường bị chặn do thi công.", maxLength=500, nullable=True),
            },
            ("reason",),
        ),
        "IncidentUpdateRequest": obj(
            "Kết quả xử lý sự cố bởi vận hành.",
            {
                "status": prop("string", "Trạng thái xử lý mới.", "RESOLVED", enum=["OPEN", "IN_REVIEW", "RESOLVED", "CANCELLED"]),
                "resolution": prop("string", "Ghi chú kết quả xử lý.", "Đã xác minh và hỗ trợ hai bên.", minLength=1, maxLength=1000),
            },
            ("status", "resolution"),
        ),
        "IncidentResponse": obj(
            "Sự cố gắn với chuyến đi.",
            {
                "id": prop("string", "Định danh sự cố.", "115e8400-e29b-41d4-a716-446655440000", **UUID),
                "tripId": prop("string", "Định danh chuyến liên quan.", "a50e8400-e29b-41d4-a716-446655440000", **UUID),
                "reportedBy": prop("string", "Vai trò người báo cáo.", "CUSTOMER", enum=["CUSTOMER", "DRIVER", "OPERATOR"]),
                "reason": prop("string", "Nhóm nguyên nhân.", "ROUTE", enum=["ROUTE", "DRIVER", "PASSENGER", "OTHER"]),
                "note": prop("string", "Mô tả bổ sung.", "Tuyến đường bị chặn do thi công.", maxLength=500, nullable=True),
                "status": prop("string", "Trạng thái xử lý.", "OPEN", enum=["OPEN", "IN_REVIEW", "RESOLVED", "CANCELLED"]),
                "createdAt": prop("string", "Thời điểm ghi nhận.", "2026-09-24T10:20:00+07:00", **DATE_TIME),
            },
            ("id", "tripId", "reportedBy", "reason", "status", "createdAt"),
        ),
        "OperationsReportResponse": obj(
            "Chỉ số vận hành tổng hợp theo múi giờ Asia/Ho_Chi_Minh.",
            {
                "from": prop("string", "Mốc bắt đầu, bao gồm.", "2026-09-01T00:00:00+07:00", **DATE_TIME),
                "to": prop("string", "Mốc kết thúc, không bao gồm.", "2026-10-01T00:00:00+07:00", **DATE_TIME),
                "groupBy": prop("string", "Đơn vị tổng hợp.", "DAY", enum=["DAY", "MONTH"]),
                "totalTrips": prop("integer", "Tổng số chuyến.", 1250, format="int64", minimum=0),
                "completedTrips": prop("integer", "Số chuyến hoàn thành.", 1100, format="int64", minimum=0),
                "cancelledTrips": prop("integer", "Số chuyến hủy.", 90, format="int64", minimum=0),
                "revenue": prop("number", "Tổng doanh thu VND.", 48250000, **MONEY),
                "completionRate": prop("number", "Tỷ lệ hoàn thành; null/N/A khi mẫu số bằng 0.", 0.88, format="double", minimum=0, maximum=1, nullable=True),
                "driverEfficiency": prop("number", "Hiệu suất tài xế; null/N/A khi mẫu số bằng 0.", 0.76, format="double", minimum=0, maximum=1, nullable=True),
            },
            ("from", "to", "groupBy", "totalTrips", "completedTrips", "cancelledTrips", "revenue"),
        ),
    }

    paginated = {
        "PaginatedRideOfferResponse": "RideOfferResponse",
        "PaginatedNotificationResponse": "NotificationResponse",
        "PaginatedTripResponse": "TripResponse",
        "PaginatedDriverResponse": "DriverResponse",
        "PaginatedIncidentResponse": "IncidentResponse",
    }
    for name, item_name in paginated.items():
        schemas[name] = {
            "allOf": [
                ref("schemas", "PaginatedResponse"),
                {
                    "type": "object",
                    "description": f"Phản hồi phân trang của {item_name}.",
                    "properties": {
                        "data": {
                            "type": "array",
                            "description": "Danh sách kết quả của trang.",
                            "items": ref("schemas", item_name),
                            "example": [],
                        }
                    },
                },
            ]
        }
    return schemas


def build_parameters():
    return {
        "ResourceId": {
            "name": "id",
            "in": "path",
            "required": True,
            "description": "Định danh UUID của tài nguyên trong đường dẫn.",
            "schema": {"type": "string", "format": "uuid", "pattern": UUID["pattern"], "example": "a50e8400-e29b-41d4-a716-446655440000"},
        },
        "Page": {
            "name": "page",
            "in": "query",
            "required": False,
            "description": "Số trang, bắt đầu từ 1.",
            "schema": {"type": "integer", "format": "int32", "minimum": 1, "maximum": 1000, "default": 1, "example": 1},
        },
        "Size": {
            "name": "size",
            "in": "query",
            "required": False,
            "description": "Số phần tử mỗi trang.",
            "schema": {"type": "integer", "format": "int32", "minimum": 1, "maximum": 100, "default": 20, "example": 20},
        },
        "From": {
            "name": "from",
            "in": "query",
            "required": False,
            "description": "Thời điểm bắt đầu (bao gồm); khoảng truy vấn tối đa 366 ngày.",
            "schema": {"type": "string", "format": "date-time", "example": "2026-09-01T00:00:00+07:00"},
        },
        "To": {
            "name": "to",
            "in": "query",
            "required": False,
            "description": "Thời điểm kết thúc (không bao gồm); khoảng truy vấn tối đa 366 ngày.",
            "schema": {"type": "string", "format": "date-time", "example": "2026-10-01T00:00:00+07:00"},
        },
        "GroupBy": {
            "name": "groupBy",
            "in": "query",
            "required": True,
            "description": "Đơn vị tổng hợp báo cáo.",
            "schema": {"type": "string", "enum": ["DAY", "MONTH"], "example": "DAY"},
        },
        "IdempotencyKey": {
            "name": "Idempotency-Key",
            "in": "header",
            "required": True,
            "description": "UUID chống xử lý lặp, lưu 24 giờ; cùng khóa khác payload trả 409.",
            "schema": {"type": "string", "format": "uuid", "pattern": UUID["pattern"], "example": "225e8400-e29b-41d4-a716-446655440000"},
        },
        "ProviderSignature": {
            "name": "X-Provider-Signature",
            "in": "header",
            "required": True,
            "description": "Chữ ký hoặc shared secret của nhà cung cấp sandbox.",
            "schema": {"type": "string", "minLength": 16, "maxLength": 512, "example": "sha256=sandbox-signature"},
        },
    }


def build_responses():
    definitions = {
        "BadRequest": ("Yêu cầu sai cú pháp hoặc schema.", "VALIDATION_ERROR", "Dữ liệu yêu cầu không hợp lệ."),
        "Unauthorized": ("Thiếu hoặc sai thông tin xác thực.", "UNAUTHORIZED", "Cần xác thực để tiếp tục."),
        "Forbidden": ("Vai trò không có quyền thực hiện.", "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."),
        "NotFound": ("Không tìm thấy tài nguyên hoặc tài nguyên không thuộc người dùng.", "NOT_FOUND", "Không tìm thấy tài nguyên."),
        "Conflict": ("Xung đột trạng thái hoặc khóa idempotency.", "STATE_CONFLICT", "Trạng thái hiện tại không cho phép thao tác."),
        "UnprocessableEntity": ("Dữ liệu đúng schema nhưng vi phạm quy tắc nghiệp vụ.", "BUSINESS_RULE_VIOLATION", "Yêu cầu vi phạm quy tắc nghiệp vụ."),
        "TooManyRequests": ("Vượt giới hạn tần suất.", "RATE_LIMIT_EXCEEDED", "Vui lòng thử lại sau."),
        "InternalServerError": ("Lỗi nội bộ không mong đợi.", "INTERNAL_ERROR", "Đã xảy ra lỗi nội bộ."),
        "BadGateway": ("Dịch vụ phụ thuộc trả lỗi hoặc không sẵn sàng.", "DEPENDENCY_ERROR", "Không thể kết nối dịch vụ phụ thuộc."),
    }
    return {
        name: json_response(description, ref("schemas", "ErrorResponse"), {"code": code, "message": message, "details": [], "requestId": "req_01J8QH8Y7W"})
        for name, (description, code, message) in definitions.items()
    }


def build_paths():
    ok_user = json_response("Thành công.", ref("schemas", "UserResponse"))
    ok_driver = json_response("Thành công.", ref("schemas", "DriverResponse"))
    ok_trip = json_response("Thành công.", ref("schemas", "TripResponse"))
    id_param = [ref("parameters", "ResourceId")]
    paging = [ref("parameters", "Page"), ref("parameters", "Size")]
    paths = {}

    paths["/api/v1/auth/register"] = {
        "post": operation("Authentication and Accounts", "registerCustomer", "Đăng ký khách hàng", "Tạo tài khoản khách hàng bằng số điện thoại duy nhất.", "UC-01; FR-01; BRULE-01", ["PUBLIC"], {"201": json_response("Tài khoản đã được tạo.", ref("schemas", "UserResponse")), **error_responses("400", "409", "422", "429", "500")}, security=[], requestBody=request("UserCreateRequest", {"phone": "+84901234567", "name": "Nguyễn Văn An", "password": "Cab@123456"}))
    }
    paths["/api/v1/auth/login"] = {
        "post": operation("Authentication and Accounts", "login", "Đăng nhập", "Xác thực tài khoản và phát access token 30 phút cùng refresh token 7 ngày.", "UC-02; FR-04; BRULE-01", ["PUBLIC"], {"200": json_response("Đăng nhập thành công.", ref("schemas", "AuthTokensResponse")), **error_responses("400", "401", "429", "500")}, security=[], requestBody=request("LoginRequest", {"phone": "+84901234567", "password": "Cab@123456"}))
    }
    paths["/api/v1/auth/refresh"] = {
        "post": operation("Authentication and Accounts", "refreshAccessToken", "Làm mới token", "Xoay vòng refresh token và cấp access token mới.", "UC-02; FR-04; BRULE-01", ["PUBLIC"], {"200": json_response("Token mới đã được cấp.", ref("schemas", "AuthTokensResponse")), **error_responses("400", "401", "429", "500")}, security=[], requestBody=request("TokenRefreshRequest", {"refreshToken": "eyJhbGciOiJIUzI1NiJ9.refresh"}))
    }
    paths["/api/v1/auth/logout"] = {
        "post": operation("Authentication and Accounts", "logout", "Đăng xuất", "Thu hồi refresh token của phiên hiện tại.", "UC-02; FR-04; BRULE-01", ["CUSTOMER", "DRIVER", "OPERATOR", "ADMIN", "EXECUTIVE"], {"204": {"description": "Đăng xuất thành công, không có nội dung."}, **error_responses("401", "500")})
    }
    paths["/api/v1/me/profile"] = {
        "get": operation("Authentication and Accounts", "getMyProfile", "Xem hồ sơ của tôi", "Trả hồ sơ thuộc tài khoản đang xác thực.", "UC-03; FR-05; BRULE-01", ["CUSTOMER", "DRIVER", "OPERATOR", "ADMIN", "EXECUTIVE"], {"200": ok_user, **error_responses("401", "404", "500")}),
        "patch": operation("Authentication and Accounts", "updateMyProfile", "Cập nhật hồ sơ của tôi", "Cập nhật tên hoặc số điện thoại; số điện thoại phải duy nhất.", "UC-03; FR-05; BRULE-01", ["CUSTOMER"], {"200": ok_user, **error_responses("400", "401", "403", "409", "422", "500")}, requestBody=request("ProfileUpdateRequest", {"name": "Nguyễn Văn Bình", "phone": "+84987654321"})),
    }
    paths["/api/v1/drivers/me/availability"] = {
        "patch": operation("Driver Profiles and Availability", "updateMyDriverAvailability", "Cập nhật trạng thái nhận chuyến", "Tài xế chỉ ONLINE khi hồ sơ và xe hoạt động, đồng thời không có chuyến mở.", "UC-04; FR-02; FR-06; BRULE-02", ["DRIVER"], {"200": ok_driver, **error_responses("400", "401", "403", "409", "422", "500")}, requestBody=request("DriverAvailabilityRequest", {"availability": "ONLINE"}))
    }
    paths["/api/v1/drivers/me/offers"] = {
        "get": operation("Driver Matching and Dispatch", "listMyRideOffers", "Danh sách đề nghị chuyến", "Trả các đề nghị dành cho tài xế; mỗi đề nghị có cửa sổ phản hồi 20 giây.", "UC-07; FR-12..FR-14; BRULE-04..BRULE-06", ["DRIVER"], {"200": json_response("Danh sách đề nghị.", ref("schemas", "PaginatedRideOfferResponse")), **error_responses("401", "403", "429", "500")}, parameters=paging)
    }
    paths["/api/v1/drivers/me/location"] = {
        "put": operation("Trips and Tracking", "updateMyDriverLocation", "Cập nhật vị trí tài xế", "Ghi nhận vị trí WGS84 mới nhất; khi online hoặc đang chạy chuyến, tối đa 10 giây mỗi lần cập nhật.", "UC-08; FR-21; BRULE-04; BRULE-07", ["DRIVER"], {"200": json_response("Vị trí đã cập nhật.", ref("schemas", "DriverLocationResponse")), **error_responses("400", "401", "403", "422", "429", "500")}, requestBody=request("DriverLocationRequest", {"latitude": 10.7769, "longitude": 106.7009}))
    }
    paths["/api/v1/ride-requests"] = {
        "post": operation("Ride Requests", "createRideRequest", "Tạo yêu cầu chuyến", "Ghi nhận điểm đón, điểm đến, loại xe và bắt đầu ghép tài xế nội bộ.", "UC-05; FR-07..FR-09; BRULE-03; RULE-02", ["CUSTOMER"], {"201": json_response("Yêu cầu chuyến đã tạo.", ref("schemas", "RideRequestResponse")), **error_responses("400", "401", "403", "409", "422", "429", "500")}, parameters=[ref("parameters", "IdempotencyKey")], requestBody=request("RideRequestCreateRequest", {"pickup": {"latitude": 10.7769, "longitude": 106.7009, "address": "1 Lê Duẩn, Quận 1, TP.HCM"}, "destination": {"latitude": 10.8022, "longitude": 106.7145, "address": "Bình Thạnh, TP.HCM"}, "vehicleType": "MOTORCYCLE"}))
    }
    paths["/api/v1/ride-requests/{id}"] = {
        "get": operation("Ride Requests", "getRideRequest", "Xem yêu cầu chuyến", "Chỉ khách hàng sở hữu được xem yêu cầu chuyến.", "UC-05; FR-08; BRULE-03", ["CUSTOMER"], {"200": json_response("Chi tiết yêu cầu chuyến.", ref("schemas", "RideRequestResponse")), **error_responses("401", "403", "404", "500")}, parameters=id_param)
    }
    paths["/api/v1/ride-offers/{id}/responses"] = {
        "post": operation("Driver Matching and Dispatch", "respondToRideOffer", "Phản hồi đề nghị chuyến", "Ghi nhận ACCEPT hoặc DECLINE; ghép chuyến là thao tác nguyên tử và đề nghị hết hạn trả 409.", "UC-07; FR-12..FR-15; BRULE-04..BRULE-06; RULE-02", ["DRIVER"], {"200": ok_trip, **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=[*id_param, ref("parameters", "IdempotencyKey")], requestBody=request("RideOfferDecisionRequest", {"decision": "ACCEPT"}))
    }
    paths["/api/v1/trips/{id}/status"] = {
        "patch": operation("Trips and Tracking", "updateTripStatus", "Cập nhật trạng thái chuyến", "Tài xế được gán chuyển trạng thái theo chuỗi ASSIGNED → ARRIVED_AT_PICKUP → PICKED_UP → IN_PROGRESS → COMPLETED.", "UC-09; FR-17..FR-22; BRULE-07", ["DRIVER"], {"200": ok_trip, **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("TripStatusUpdateRequest", {"status": "ARRIVED_AT_PICKUP"}))
    }
    paths["/api/v1/trips/{id}/cancellation"] = {
        "post": operation("Trips and Tracking", "cancelTrip", "Hủy chuyến", "Khách hàng hoặc tài xế được hủy trước PICKED_UP và phải nêu lý do; sau đó chỉ vận hành xử lý qua sự cố có audit.", "UC-09; FR-17..FR-22; BRULE-07", ["CUSTOMER", "DRIVER", "OPERATOR"], {"200": ok_trip, **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("TripCancellationRequest", {"reason": "Khách hàng thay đổi kế hoạch"}))
    }
    paths["/api/v1/trips/{id}"] = {
        "get": operation("Trips and Tracking", "getTrip", "Xem chuyến đi", "Khách hàng sở hữu, tài xế được gán hoặc vận hành có quyền được xem; ETA có thể null khi thiếu dữ liệu định tuyến.", "UC-10; FR-21; BRULE-07", ["CUSTOMER", "DRIVER", "OPERATOR"], {"200": ok_trip, **error_responses("401", "403", "404", "500")}, parameters=id_param)
    }
    paths["/api/v1/trips/{id}/fare"] = {
        "get": operation("Fare and Payments", "getTripFare", "Xem cước chuyến", "Trả cước VND đã tính nội bộ; chỉ có sau khi chuyến hoàn thành.", "UC-11; FR-23; BRULE-08; BRULE-09", ["CUSTOMER", "DRIVER", "OPERATOR"], {"200": json_response("Cước chuyến.", ref("schemas", "FareResponse")), **error_responses("401", "403", "404", "409", "500")}, parameters=id_param)
    }
    paths["/api/v1/trips/{id}/payments"] = {
        "post": operation("Fare and Payments", "createTripPayment", "Tạo thanh toán chuyến", "Tạo thanh toán tiền mặt hoặc điện tử; một chuyến chỉ có tối đa một thanh toán thành công.", "UC-12; FR-24..FR-27; BRULE-10; RULE-02", ["CUSTOMER"], {"201": json_response("Thanh toán đã tạo.", ref("schemas", "PaymentResponse")), **error_responses("400", "401", "403", "404", "409", "422", "429", "500", "502")}, parameters=[*id_param, ref("parameters", "IdempotencyKey")], requestBody=request("PaymentCreateRequest", {"method": "ELECTRONIC"})),
        "get": operation("Fare and Payments", "getTripPayment", "Xem thanh toán chuyến", "Trả trạng thái thanh toán hiện tại của chuyến.", "UC-12; FR-24..FR-27; BRULE-10", ["CUSTOMER", "DRIVER", "OPERATOR"], {"200": json_response("Thanh toán của chuyến.", ref("schemas", "PaymentResponse")), **error_responses("401", "403", "404", "500")}, parameters=id_param),
    }
    paths["/api/v1/payments/provider-callbacks"] = {
        "post": operation("Fare and Payments", "receivePaymentProviderCallback", "Nhận callback thanh toán", "Nhận callback idempotent từ nhà cung cấp sandbox; chỉ kết quả đã xác minh mới được ghi nhận.", "UC-12; FR-25..FR-27; BRULE-10", ["PAYMENT_PROVIDER"], {"200": json_response("Callback đã xử lý hoặc đã được xử lý trước đó.", ref("schemas", "PaymentResponse")), **error_responses("400", "401", "404", "409", "500", "502")}, security=[], parameters=[ref("parameters", "ProviderSignature")], requestBody=request("ProviderCallbackRequest", {"providerReference": "sandbox_txn_123", "paymentId": "c50e8400-e29b-41d4-a716-446655440000", "status": "PAID", "occurredAt": "2026-09-24T10:38:00+07:00"}), **{"x-assumption": "SRS chỉ quy định chữ ký/shared secret cho sandbox nhưng chưa chốt tên header; dùng X-Provider-Signature để đặc tả có thể kiểm thử."})
    }
    paths["/api/v1/payments/{id}/cash-confirmation"] = {
        "post": operation("Fare and Payments", "confirmCashPayment", "Xác nhận thu tiền mặt", "Tài xế xác nhận đã nhận tiền mặt; vận hành có thể tra soát tranh chấp qua audit.", "UC-12; FR-24; FR-26; BRULE-10", ["DRIVER"], {"200": json_response("Thanh toán tiền mặt đã xác nhận.", ref("schemas", "PaymentResponse")), **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("CashConfirmationRequest", {"received": True}))
    }
    paths["/api/v1/notifications"] = {
        "get": operation("Notifications", "listMyNotifications", "Danh sách thông báo", "Trả thông báo in-app của tài khoản đang xác thực.", "UC-13; FR-09; FR-15; FR-18; FR-26; FR-27; BRULE-11", ["CUSTOMER", "DRIVER"], {"200": json_response("Danh sách thông báo.", ref("schemas", "PaginatedNotificationResponse")), **error_responses("401", "403", "429", "500")}, parameters=paging)
    }
    paths["/api/v1/notifications/{id}"] = {
        "patch": operation("Notifications", "markNotificationRead", "Đánh dấu thông báo đã đọc", "Chỉ người nhận sở hữu thông báo được cập nhật.", "UC-13; BRULE-11", ["CUSTOMER", "DRIVER"], {"200": json_response("Thông báo đã cập nhật.", ref("schemas", "NotificationResponse")), **error_responses("400", "401", "403", "404", "422", "500")}, parameters=id_param, requestBody=request("NotificationUpdateRequest", {"read": True}))
    }
    paths["/api/v1/me/trips"] = {
        "get": operation("Trip History and Ratings", "listMyTrips", "Lịch sử chuyến của tôi", "Trả lịch sử chuyến có phân trang và lọc thời gian; from bao gồm, to không bao gồm, tối đa 366 ngày.", "UC-14; FR-28; FR-29; BRULE-07", ["CUSTOMER"], {"200": json_response("Lịch sử chuyến.", ref("schemas", "PaginatedTripResponse")), **error_responses("400", "401", "403", "422", "429", "500")}, parameters=[*paging, ref("parameters", "From"), ref("parameters", "To")])
    }
    paths["/api/v1/trips/{id}/rating"] = {
        "post": operation("Trip History and Ratings", "rateTrip", "Đánh giá chuyến", "Khách hàng sở hữu được đánh giá một lần, điểm nguyên 1–5, trong 7 ngày kể từ khi hoàn thành.", "UC-15; FR-30; BRULE-07", ["CUSTOMER"], {"201": json_response("Đánh giá đã tạo.", ref("schemas", "RatingResponse")), **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("RatingCreateRequest", {"score": 5, "comment": "Tài xế thân thiện và đúng giờ."}))
    }
    paths["/api/v1/operations/drivers"] = {
        "get": operation("Operations and Incident Support", "listDriversForOperations", "Danh sách tài xế vận hành", "Vận hành tra cứu trạng thái hồ sơ, phương tiện và khả dụng của tài xế.", "UC-16; FR-31..FR-33; BRULE-12; BRULE-13", ["OPERATOR", "ADMIN"], {"200": json_response("Danh sách tài xế.", ref("schemas", "PaginatedDriverResponse")), **error_responses("401", "403", "429", "500")}, parameters=paging)
    }
    paths["/api/v1/operations/drivers/{id}"] = {
        "patch": operation("Operations and Incident Support", "updateDriverForOperations", "Cập nhật trạng thái tài xế", "Vận hành khóa hoặc kích hoạt hồ sơ tài xế theo quyền; thay đổi được audit.", "UC-16; FR-31..FR-35; BRULE-12..BRULE-14", ["OPERATOR", "ADMIN"], {"200": ok_driver, **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("OperationDriverUpdateRequest", {"status": "SUSPENDED"}))
    }
    paths["/api/v1/admin/roles/{id}"] = {
        "patch": operation("Operations and Incident Support", "updateAdministrativeRole", "Cập nhật vai trò quản trị", "Quản trị viên cấp hoặc thu hồi vai trò vận hành/báo cáo; thao tác được audit.", "UC-16; FR-31; FR-35; BRULE-12..BRULE-14", ["ADMIN"], {"200": ok_user, **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("RoleUpdateRequest", {"role": "OPERATOR"}))
    }
    paths["/api/v1/admin/fares"] = {
        "post": operation("Operations and Incident Support", "createFareTable", "Tạo bảng giá", "Quản trị viên tạo phiên bản bảng giá; phiên bản được lưu cùng yêu cầu chuyến và thao tác được audit.", "UC-16; FR-35; BRULE-08; BRULE-09; BRULE-14", ["ADMIN"], {"201": json_response("Bảng giá đã tạo.", ref("schemas", "FareTableResponse")), **error_responses("400", "401", "403", "409", "422", "500")}, requestBody=request("FareTableCreateRequest", {"version": "fare-2026-02", "vehicleType": "MOTORCYCLE", "openingFare": 10000, "includedKm": 2, "perKmFare": 4000, "effectiveFrom": "2026-10-01T00:00:00+07:00"}))
    }
    paths["/api/v1/trips/{id}/incidents"] = {
        "post": operation("Operations and Incident Support", "createTripIncident", "Báo cáo sự cố chuyến", "Khách hàng hoặc tài xế của chuyến tạo nguồn sự cố để vận hành xử lý.", "UC-17; FR-34; FR-35; BRULE-12..BRULE-14", ["CUSTOMER", "DRIVER"], {"201": json_response("Sự cố đã ghi nhận.", ref("schemas", "IncidentResponse")), **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("IncidentCreateRequest", {"reason": "ROUTE", "note": "Tuyến đường bị chặn do thi công."}), **{"x-assumption": "SRS 18.9 ghi đây là endpoint bổ sung baseline để cung cấp nguồn dữ liệu cho UC-17; hợp đồng chi tiết chưa được UC gốc mô tả."})
    }
    paths["/api/v1/operations/incidents"] = {
        "get": operation("Operations and Incident Support", "listIncidentsForOperations", "Danh sách sự cố", "Vận hành xem hàng đợi sự cố để hỗ trợ và xử lý.", "UC-17; FR-34; FR-35; BRULE-12..BRULE-14", ["OPERATOR", "ADMIN"], {"200": json_response("Danh sách sự cố.", ref("schemas", "PaginatedIncidentResponse")), **error_responses("401", "403", "429", "500")}, parameters=paging)
    }
    paths["/api/v1/operations/incidents/{id}"] = {
        "patch": operation("Operations and Incident Support", "updateIncidentForOperations", "Xử lý sự cố", "Cập nhật trạng thái và kết quả xử lý; thao tác phải được audit.", "UC-17; FR-34; FR-35; BRULE-12..BRULE-14", ["OPERATOR", "ADMIN"], {"200": json_response("Sự cố đã cập nhật.", ref("schemas", "IncidentResponse")), **error_responses("400", "401", "403", "404", "409", "422", "500")}, parameters=id_param, requestBody=request("IncidentUpdateRequest", {"status": "RESOLVED", "resolution": "Đã xác minh và hỗ trợ hai bên."}))
    }
    paths["/api/v1/reports/operations"] = {
        "get": operation("Reporting", "getOperationsReport", "Báo cáo vận hành", "Tổng hợp chuyến, doanh thu, tỷ lệ hoàn thành/hủy và hiệu suất tài xế theo Asia/Ho_Chi_Minh; mẫu số 0 trả null/N/A.", "UC-18; FR-36..FR-38; NFR-01..NFR-03", ["EXECUTIVE", "ADMIN"], {"200": json_response("Báo cáo vận hành.", ref("schemas", "OperationsReportResponse")), **error_responses("400", "401", "403", "422", "429", "500")}, parameters=[ref("parameters", "From"), ref("parameters", "To"), ref("parameters", "GroupBy")])
    }
    return paths


def build_spec():
    tags = [
        ("Authentication and Accounts", "Đăng ký, xác thực và hồ sơ tài khoản."),
        ("Driver Profiles and Availability", "Hồ sơ và trạng thái sẵn sàng của tài xế."),
        ("Ride Requests", "Tiếp nhận và tra cứu yêu cầu chuyến."),
        ("Driver Matching and Dispatch", "Đề nghị chuyến và phản hồi của tài xế; thuật toán ghép chạy nội bộ."),
        ("Trips and Tracking", "Vòng đời chuyến và theo dõi vị trí."),
        ("Fare and Payments", "Cước chuyến và thanh toán."),
        ("Notifications", "Thông báo in-app."),
        ("Trip History and Ratings", "Lịch sử chuyến và đánh giá tài xế."),
        ("Operations and Incident Support", "Quản lý vận hành, phân quyền, bảng giá và sự cố."),
        ("Reporting", "Báo cáo vận hành tổng hợp."),
    ]
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "CAB System API",
            "version": "1.0.0",
            "description": "Đặc tả API pilot được truy vết từ SRS.md, mục 18.9 và các quy tắc nghiệp vụ liên quan.",
            "license": {"name": "Proprietary", "url": "https://cab-system.invalid/license"},
            "x-assumption": "SRS không quy định URL giấy phép; miền .invalid được dùng làm placeholder tài liệu và phải được thay trước khi phát hành.",
        },
        "servers": [{"url": "/", "description": "Cùng origin với trang tài liệu hoặc API gateway"}],
        "tags": [{"name": name, "description": description} for name, description in tags],
        "security": [{"bearerAuth": []}],
        "paths": build_paths(),
        "components": {
            "schemas": build_schemas(),
            "parameters": build_parameters(),
            "responses": build_responses(),
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT access token có thời hạn 30 phút. Không truyền token qua URL.",
                }
            },
        },
    }


PATH_GROUPS = {
    "auth": ["/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout"],
    "accounts": ["/api/v1/me/profile", "/api/v1/me/trips"],
    "drivers": ["/api/v1/drivers/me/availability", "/api/v1/drivers/me/offers", "/api/v1/drivers/me/location"],
    "ride-requests": ["/api/v1/ride-requests", "/api/v1/ride-requests/{id}"],
    "ride-offers": ["/api/v1/ride-offers/{id}/responses"],
    "trips": ["/api/v1/trips/{id}", "/api/v1/trips/{id}/status", "/api/v1/trips/{id}/cancellation", "/api/v1/trips/{id}/fare", "/api/v1/trips/{id}/payments", "/api/v1/trips/{id}/rating", "/api/v1/trips/{id}/incidents"],
    "payments": ["/api/v1/payments/provider-callbacks", "/api/v1/payments/{id}/cash-confirmation"],
    "notifications": ["/api/v1/notifications", "/api/v1/notifications/{id}"],
    "operations": ["/api/v1/operations/drivers", "/api/v1/operations/drivers/{id}", "/api/v1/operations/incidents", "/api/v1/operations/incidents/{id}"],
    "administration": ["/api/v1/admin/roles/{id}", "/api/v1/admin/fares"],
    "reports": ["/api/v1/reports/operations"],
}


def rewrite_refs(value, context):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key == "$ref" and isinstance(item, str) and item.startswith("#/components/"):
                _, _, section, name = item.split("/", 3)
                if context == "path":
                    result[key] = f"../components/{section}/{name}.yaml" if section != "securitySchemes" else f"../components/securitySchemes.yaml#/{name}"
                elif context == "schema":
                    result[key] = f"./{name}.yaml"
                elif context == "response":
                    result[key] = f"../schemas/{name}.yaml" if section == "schemas" else item
                else:
                    result[key] = item
            else:
                result[key] = rewrite_refs(item, context)
        return result
    if isinstance(value, list):
        return [rewrite_refs(item, context) for item in value]
    return value


def dump_yaml(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=120, default_flow_style=False)
    path.write_text(content, encoding="utf-8", newline="\n")


def write_modular(spec):
    entry = {key: deepcopy(spec[key]) for key in ("openapi", "info", "servers", "tags", "security")}
    entry["paths"] = {}
    for group, path_names in PATH_GROUPS.items():
        group_data = {name: rewrite_refs(deepcopy(spec["paths"][name]), "path") for name in path_names}
        dump_yaml(API_DIR / "paths" / f"{group}.yaml", group_data)
        for name in path_names:
            pointer = name.replace("~", "~0").replace("/", "~1")
            entry["paths"][name] = {"$ref": f"./paths/{group}.yaml#/{pointer}"}

    entry["components"] = {
        "schemas": {name: {"$ref": f"./components/schemas/{name}.yaml"} for name in spec["components"]["schemas"]},
        "parameters": {name: {"$ref": f"./components/parameters/{name}.yaml"} for name in spec["components"]["parameters"]},
        "responses": {name: {"$ref": f"./components/responses/{name}.yaml"} for name in spec["components"]["responses"]},
        "securitySchemes": {"bearerAuth": {"$ref": "./components/securitySchemes.yaml#/bearerAuth"}},
    }
    dump_yaml(API_DIR / "openapi.yaml", entry)

    for name, schema in spec["components"]["schemas"].items():
        dump_yaml(API_DIR / "components" / "schemas" / f"{name}.yaml", rewrite_refs(deepcopy(schema), "schema"))
    for name, parameter in spec["components"]["parameters"].items():
        dump_yaml(API_DIR / "components" / "parameters" / f"{name}.yaml", parameter)
    for name, response in spec["components"]["responses"].items():
        dump_yaml(API_DIR / "components" / "responses" / f"{name}.yaml", rewrite_refs(deepcopy(response), "response"))
    dump_yaml(API_DIR / "components" / "securitySchemes.yaml", spec["components"]["securitySchemes"])


README = """# CAB System API documentation

`openapi.yaml` là entry point modular. Bản tương đương một file nằm tại `../openapi.yaml`.

## Chạy và kiểm tra

Từ thư mục gốc dự án:

```powershell
npx @redocly/cli lint openapi.yaml
npx @redocly/cli lint api-document/openapi.yaml
npx @redocly/cli bundle api-document/openapi.yaml -o /tmp/bundled.yaml
```

Swagger UI không cần Docker (mặc định mở tại `http://127.0.0.1:8080`):

```powershell
npx swagger-ui-watcher api-document/openapi.yaml --port 8080
```

Tùy chọn Swagger UI bằng Docker, nếu máy đã cài Docker Desktop:

```powershell
docker run --rm -p 8080:8080 -e SWAGGER_JSON=/spec/api-document/openapi.yaml -v "${PWD}:/spec" swaggerapi/swagger-ui
```

Với bản một file, mở `../openapi.yaml` trong <https://editor.swagger.io>.

## Quy ước

- Path bắt đầu bằng `/api/v1`, dùng danh từ số nhiều và HTTP method theo ngữ nghĩa REST.
- `operationId` dùng camelCase và duy nhất; mỗi operation có `x-srs-ref` và `x-roles`.
- Tên schema/parameter/response dùng PascalCase; tên file path dùng lowercase/kebab-case.
- Schema dùng `$ref` tương đối, không sao chép định nghĩa giữa các file.

## Thêm endpoint

1. Thêm Path Item vào file phù hợp trong `paths/` và gắn `operationId`, `x-srs-ref`, `x-roles`.
2. Thêm schema, parameter hoặc response mới vào đúng thư mục `components/`, mỗi định nghĩa một file.
3. Khai báo `$ref` của path và component mới trong `openapi.yaml`.
4. Chạy hai lệnh lint và bundle ở trên trước khi hoàn tất.
"""


def main():
    spec = build_spec()
    dump_yaml(ROOT / "openapi.yaml", spec)
    write_modular(spec)
    (API_DIR / "README.md").write_text(README, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
