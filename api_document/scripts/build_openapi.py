from __future__ import annotations

import copy
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


API_ROWS = [
    ("API-01", "Identity&Driver", "POST", "/auth/register", "UC-01.1", ["Public"], "RegisterRequest", "UserResponse", 201, [400,409,422], "key", "10/min/IP", "registerCustomer", "customer/uc-01.1-dang-ky-khach-hang.yaml"),
    ("API-02", "Identity&Driver", "POST", "/auth/driver-registrations", "UC-01.2", ["Public"], "DriverRegistrationRequest", "DriverApplication", 201, [400,409,422], "key", "10/min/IP", "registerDriver", "driver/uc-01.2-dang-ky-tai-xe.yaml"),
    ("API-03", "Identity&Driver", "POST", "/auth/login", "UC-02", ["Public"], "LoginRequest", "AuthTokens", 200, [401,423,429], "none", "10/min/IP", "login", "shared/uc-02-dang-nhap.yaml"),
    ("API-04", "Identity&Driver", "POST", "/auth/refresh", "UC-02", ["Authenticated"], "RefreshRequest", "AuthTokens", 200, [401,409], "key", "100/min/user", "refreshToken", "shared/uc-02-dang-nhap.yaml"),
    ("API-05", "Identity&Driver", "PATCH", "/me/profile", "UC-03.1", ["CUSTOMER","DRIVER"], "ProfilePatch", "Profile", 200, [403,409,422], "key+version", "100/min/user", "updateMyProfile", "shared/uc-03.1-cap-nhat-ho-so.yaml"),
    ("API-06", "Identity&Driver", "PUT", "/drivers/me/availability", "UC-04", ["DRIVER"], "AvailabilityRequest", "Availability", 200, [403,409,422], "key+version", "100/min/user", "updateAvailability", "driver/uc-04-cap-nhat-availability.yaml"),
    ("API-07", "Identity&Driver", "PUT", "/drivers/me/location", "UC-08", ["DRIVER"], "LocationRequest", "Location", 200, [409,422,429], "newer-wins", "12/min/driver", "updateDriverLocation", "driver/uc-08-cap-nhat-vi-tri.yaml"),
    ("API-08", "Identity&Driver", "POST", "/operations/internal-users", "UC-16.6", ["ADMIN"], "InternalUserCreate", "User", 201, [403,409,422], "key", "100/min/user", "createInternalUser", "operator/uc-16.6-tao-tai-khoan-noi-bo.yaml"),
    ("API-09", "Identity&Driver", "POST", "/operations/accounts/{id}/lock", "UC-16.5", ["OPERATOR"], "AccountAction", "User", 200, [403,404,409], "key+version", "100/min/user", "lockAccount", "operator/uc-16.5-khoa-mo-tai-khoan.yaml"),
    ("API-10", "Identity&Driver", "POST", "/operations/accounts/{id}/unlock", "UC-16.5", ["OPERATOR"], "AccountAction", "User", 200, [403,404,409], "key+version", "100/min/user", "unlockAccount", "operator/uc-16.5-khoa-mo-tai-khoan.yaml"),
    ("API-11", "Ride", "POST", "/ride-requests", "UC-05.1", ["CUSTOMER"], "RideRequestCreate", "RideRequest", 201, [409,422,429], "key", "5/min/user", "createRideRequest", "customer/uc-05.1-tao-yeu-cau-dat-xe.yaml"),
    ("API-12", "Ride", "POST", "/ride-requests/{id}/cancellation", "UC-05.2", ["CUSTOMER"], "Cancellation", "RideRequest", 200, [403,409], "key+version", "100/min/user", "cancelRideRequest", "customer/uc-05.2-huy-yeu-cau.yaml"),
    ("API-13", "Ride", "POST", "/ride-offers/{id}/responses", "UC-07.1/07.2", ["DRIVER"], "OfferDecision", "RideOffer", 200, [403,409,410], "key+version", "100/min/user", "respondToRideOffer", "driver/uc-07-phan-hoi-loi-moi.yaml"),
    ("API-14", "Ride", "PUT", "/trips/{id}/status", "UC-09.1", ["DRIVER"], "TripStatusUpdate", "Trip", 200, [403,409,422], "key+version", "100/min/user", "updateTripStatus", "driver/uc-09.1-cap-nhat-moc-chuyen.yaml"),
    ("API-15", "Ride", "POST", "/trips/{id}/cancellation", "UC-09.2", ["CUSTOMER","DRIVER"], "Cancellation", "Trip", 200, [403,409,422], "key+version", "100/min/user", "cancelTrip", "shared/uc-09.2-huy-chuyen.yaml"),
    ("API-16", "Ride", "GET", "/trips/{id}", "UC-10", ["CUSTOMER","DRIVER"], None, "Trip", 200, [403,404], "none", "100/min/user", "getTrip", "shared/uc-10-theo-doi-chuyen.yaml"),
    ("API-17", "Ride", "POST", "/trips/{id}/ratings", "UC-15", ["CUSTOMER"], "RatingCreate", "Rating", 201, [403,409,422], "key", "100/min/user", "createRating", "customer/uc-15-danh-gia-tai-xe.yaml"),
    ("API-18", "Billing", "POST", "/fare-estimates", "UC-05.1", ["CUSTOMER"], "FareEstimateRequest", "FareEstimate", 200, [422,429], "key", "100/min/user", "estimateFare", "customer/uc-05.1-tao-yeu-cau-dat-xe.yaml"),
    ("API-19", "Billing", "GET", "/trips/{id}/fare", "UC-11", ["CUSTOMER","DRIVER"], None, "Fare", 200, [403,404], "none", "100/min/user", "getTripFare", "shared/uc-11-xem-cuoc.yaml"),
    ("API-20", "Billing", "POST", "/fares/{id}/reviews", "UC-11.2", ["OPERATOR"], "FareReviewRequest", "Fare", 200, [403,409,422], "key+version", "100/min/user", "reviewFare", "operator/uc-11.2-fare-review.yaml"),
    ("API-21", "Billing", "POST", "/trips/{id}/payments", "UC-12.2", ["CUSTOMER"], "PaymentCreate", "Payment", 201, [409,422], "key", "100/min/user", "createPayment", "customer/uc-12.2-khoi-tao-thanh-toan.yaml"),
    ("API-22", "Billing", "POST", "/payments/{id}/cash-confirmation", "UC-12.1", ["DRIVER"], "CashConfirmation", "Payment", 200, [403,409], "key+version", "100/min/user", "confirmCashPayment", "driver/uc-12.1-xac-nhan-tien-mat.yaml"),
    ("API-23", "Billing", "POST", "/payments/provider-callbacks", "UC-12.3", ["Mock Provider"], "ProviderCallback", "Payment", 200, [401,404,409], "provider-event", "provider", "handlePaymentCallback", "system/uc-12.3-callback-thanh-toan.yaml"),
    ("API-24", "Notification", "GET", "/notifications", "UC-13.3", ["CUSTOMER","DRIVER"], None, "NotificationPage", 200, [401], "none", "100/min/user", "listNotifications", "shared/uc-13.3-hop-thong-bao.yaml"),
    ("API-25", "Notification", "PATCH", "/notifications/{id}", "UC-13.3", ["CUSTOMER","DRIVER"], "NotificationPatch", "Notification", 200, [403,409], "key+version", "100/min/user", "updateNotification", "shared/uc-13.3-hop-thong-bao.yaml"),
    ("API-26", "Notification", "GET", "/me/events", "UC-13.2", ["CUSTOMER","DRIVER"], "Last-Event-ID", "SSE", 200, [401,429], "event-id", "100/min/user", "streamMyEvents", "shared/uc-13.2-sse-events.yaml"),
    ("API-27", "Operations&Reporting", "GET", "/operations/trips/active", "UC-16.7", ["OPERATOR"], "filters", "ActiveTripPage", 200, [403], "none", "100/min/user", "listActiveTrips", "operator/uc-16.7-xem-chuyen-dang-chay.yaml"),
    ("API-28", "Operations&Reporting", "POST", "/trips/{id}/incidents", "UC-17.1", ["CUSTOMER","DRIVER","OPERATOR"], "IncidentCreate", "Incident", 201, [403,409,422], "key", "100/min/user", "createIncident", "shared/uc-17.1-bao-su-co.yaml"),
    ("API-29", "Operations&Reporting", "PATCH", "/operations/incidents/{id}", "UC-17.2", ["OPERATOR"], "IncidentUpdate", "Incident", 200, [403,409,422], "key+version", "100/min/user", "updateIncident", "operator/uc-17.2-xu-ly-su-co.yaml"),
    ("API-30", "Operations&Reporting", "GET", "/reports/operations", "UC-18.1/18.2", ["OPERATOR","ADMIN","EXECUTIVE"], "query", "Report", 200, [403,422], "none", "100/min/user", "getOperationsReport", "operator/uc-18-bao-cao.yaml"),
]

UC = {
"UC-01.1":("Đăng ký khách hàng","phone chưa tồn tại","Tạo User CUSTOMER ACTIVE và CustomerProfile",["FR-01","FR-49"],["DEC-29","DEC-33"],["BRULE-01"]),
"UC-01.2":("Đăng ký tài xế","phone chưa tồn tại","Tạo hồ sơ PENDING_REVIEW/OFFLINE",["FR-02","FR-49"],["DEC-02","DEC-25","DEC-33"],["BRULE-02"]),
"UC-02":("Đăng nhập","tài khoản ACTIVE, chưa bị khóa đăng nhập","Cấp access/refresh token",["FR-04","FR-49","FR-50","FR-51"],["DEC-29","DEC-30"],["BRULE-01"]),
"UC-03.1":("Cập nhật hồ sơ chung","đã xác thực, sở hữu hồ sơ","Lưu profile/version mới",["FR-05"],["DEC-34"],["BRULE-12"]),
"UC-04":("Cập nhật trạng thái sẵn sàng","User, application, vehicle ACTIVE; không Trip/offer mở","Availability đổi đúng version",["FR-06","FR-47"],["DEC-18","DEC-34"],["BRULE-02","BRULE-04"]),
"UC-05.1":("Tạo yêu cầu đặt xe","đã xác thực; điểm trong vùng; không request/trip mở","RideRequest SEARCHING và giá ước tính",["FR-07","FR-08","FR-09","FR-40","FR-48","FR-50"],["DEC-19","DEC-23","DEC-34"],["BRULE-03"]),
"UC-05.2":("Hủy yêu cầu tìm tài xế","sở hữu request; version đúng","Request và offer PENDING thành CANCELLED",["FR-08","FR-14","FR-41"],["DEC-34"],["BRULE-03","BRULE-06"]),
"UC-07.1/07.2":("Phản hồi lời mời","Offer PENDING, còn hạn và version đúng","Ghi nhận ACCEPT/DECLINE theo quy tắc cạnh tranh",["FR-13","FR-14"],["DEC-16","DEC-17","DEC-34"],["BRULE-06","BRULE-07"]),
"UC-08":("Cập nhật vị trí tài xế","ONLINE/ON_TRIP; bản tin mới hơn","Lưu vị trí; cộng distance nếu hợp lệ",["FR-21","FR-47","FR-50"],["DEC-18","DEC-22","DEC-30"],["BRULE-04"]),
"UC-09.1":("Cập nhật mốc chuyến","được giao Trip; version đúng","Trip/History/event cập nhật nguyên tử",["FR-17","FR-18","FR-19","FR-20","FR-21","FR-22","FR-41"],["DEC-34"],["BRULE-07"]),
"UC-09.2":("Hủy chuyến trước đón","Trip trước PICKED_UP; version đúng","CANCELLED; không tự điều phối lại",["FR-22","FR-41","FR-53"],["DEC-20","DEC-21","DEC-34"],["BRULE-07"]),
"UC-10":("Theo dõi chuyến","sở hữu Trip","Trả trạng thái, ETA và dữ liệu tài xế đã lọc",["FR-15","FR-18","FR-21","FR-39"],["DEC-13","DEC-24"],["BRULE-07","BRULE-12"]),
"UC-11":("Xem cước chuyến","Trip thuộc actor","Trả Fare FINALIZED hoặc FARE_REVIEW_REQUIRED",["FR-23"],["DEC-06","DEC-22","DEC-23"],["BRULE-08"]),
"UC-11.2":("Xác minh khoảng cách Fare review","Fare FARE_REVIEW_REQUIRED; có quyền/version","Fare FINALIZED và AuditRecorded",["FR-34","FR-44"],["DEC-22","DEC-34"],["BRULE-08","BRULE-12","BRULE-14"]),
"UC-12.1":("Xác nhận thanh toán tiền mặt","được giao Trip; Fare FINALIZED; không attempt chờ","Payment SUCCEEDED/CASH một lần",["FR-24","FR-26","FR-54"],["DEC-07","DEC-28","DEC-34"],["BRULE-09","BRULE-10"]),
"UC-12.2":("Khởi tạo thanh toán điện tử","Fare FINALIZED; không PENDING/UNKNOWN/SUCCEEDED","PaymentAttempt PENDING và paymentUrl giả",["FR-24","FR-25","FR-26","FR-27","FR-54"],["DEC-27","DEC-28","DEC-34"],["BRULE-09","BRULE-10"]),
"UC-12.3":("Nhận callback thanh toán","attempt tồn tại; chữ ký hợp lệ","Dedupe và lưu trạng thái cuối",["FR-25","FR-26","FR-27","FR-54"],["DEC-27","DEC-28"],["BRULE-09","BRULE-10"]),
"UC-13.2":("Theo dõi sự kiện SSE","đã xác thực","Nhận event trong 2 giây ở ít nhất 95% mẫu",["FR-09","FR-15","FR-18","FR-21"],["DEC-10","DEC-37"],["BRULE-11","BRULE-12"]),
"UC-13.3":("Đọc hộp thông báo","sở hữu recipientId","Trả inbox hoặc đánh dấu READ",["FR-09","FR-15","FR-18","FR-26","FR-41"],["DEC-10","DEC-34"],["BRULE-11","BRULE-12"]),
"UC-15":("Đánh giá tài xế","Trip COMPLETED của khách, trong 7 ngày","Tạo một Rating",["FR-30"],["DEC-34"],["BRULE-15"]),
"UC-16.5":("Khóa hoặc mở tài khoản","target CUSTOMER/DRIVER; có quyền","Đổi User status, thu hồi token khi khóa, audit",["FR-43"],["DEC-26","DEC-34"],["BRULE-12","BRULE-14"]),
"UC-16.6":("Tạo tài khoản nội bộ","ADMIN hợp lệ","User ACTIVE, mustChangePassword=true",["FR-45"],["DEC-25","DEC-35"],["BRULE-01","BRULE-12","BRULE-14"]),
"UC-16.7":("Xem chuyến đang diễn ra","có permission","Trả Trip hoạt động, driver, vị trí và tuổi trạng thái",["FR-42"],["DEC-31","DEC-32"],["BRULE-12","BRULE-16"]),
"UC-17.1":("Báo sự cố chuyến","actor thuộc Trip hoặc OPERATOR","Incident OPEN idempotent",["FR-34","FR-35"],["DEC-15","DEC-34"],["BRULE-14"]),
"UC-17.2":("Xử lý sự cố","Incident OPEN/IN_PROGRESS; version đúng","RESOLVED/CLOSED; có thể phát terminate/fare-review",["FR-34","FR-35","FR-41","FR-44","FR-55"],["DEC-20","DEC-21","DEC-22","DEC-34"],["BRULE-12","BRULE-14"]),
"UC-18.1/18.2":("Xem báo cáo vận hành","kỳ hợp lệ; from bao gồm, to loại trừ","Trả count, revenue và các tỷ lệ với asOf",["FR-36","FR-37","FR-38","FR-52"],["DEC-31"],["BRULE-16"]),
}

def s(t, **kw):
    d={"type":t}; d.update(kw); return d
def obj(props, required=()):
    d={"type":"object","properties":props}
    if required: d["required"]=list(required)
    return d
UUID=s("string",format="uuid",maxLength=36)
DT=s("string",format="date-time")
PHONE=s("string",pattern=r"^\+[1-9][0-9]{7,14}$",maxLength=15)
VERSION=s("integer",minimum=1,example=3)
POINT=obj({"lat":s("number",format="double",minimum=-90,maximum=90,example=10.776889),"lng":s("number",format="double",minimum=-180,maximum=180,example=106.700806)},["lat","lng"])

def entity_schemas():
    e={}
    e["User"]=obj({"id":UUID,"phone":PHONE,"passwordHash":s("string",maxLength=255,writeOnly=True),"roles":s("array",minItems=1,maxItems=5,uniqueItems=True,items=s("string",enum=["CUSTOMER","DRIVER","OPERATOR","ADMIN","EXECUTIVE"])),"status":s("string",enum=["PENDING","ACTIVE","LOCKED","DISABLED"]),"mustChangePassword":s("boolean")},["id","phone","passwordHash","roles","status","mustChangePassword"])
    e["CustomerProfile"]=obj({"userId":UUID,"fullName":s("string",maxLength=120),"createdAt":DT},["userId","fullName","createdAt"])
    e["DriverProfile"]=obj({"userId":UUID,"fullName":s("string",maxLength=120),"ratingAverage":s("number",format="float",minimum=1,maximum=5,nullable=True),"version":VERSION},["userId","fullName","version"])
    e["Vehicle"]=obj({"id":UUID,"driverId":UUID,"vehicleTypeId":UUID,"plate":s("string",maxLength=15),"status":s("string",enum=["PENDING_REVIEW","ACTIVE","SUSPENDED","RETIRED"])},["id","driverId","vehicleTypeId","plate","status"])
    e["RideRequest"]=obj({"id":UUID,"customerId":UUID,"pickup":POINT,"destination":POINT,"vehicleTypeId":UUID,"quotedFareVnd":s("integer",minimum=0,nullable=True),"priceVersionId":dict(s("string",format="uuid",nullable=True),maxLength=36),"status":s("string",enum=["SEARCHING","ASSIGNED","NO_DRIVER_FOUND","CANCELLED"]),"version":VERSION},["id","customerId","pickup","destination","vehicleTypeId","status","version"])
    e["Trip"]=obj({"id":UUID,"rideRequestId":UUID,"driverId":UUID,"status":s("string",enum=["ASSIGNED","ARRIVED_AT_PICKUP","PICKED_UP","IN_PROGRESS","COMPLETED","CANCELLED","TERMINATED_BY_INCIDENT"]),"distanceMeters":s("integer",minimum=0,nullable=True),"distanceSource":s("string",enum=["DRIVER_LOCATIONS","VERIFIED_BY_OPERATOR"],nullable=True),"version":VERSION},["id","rideRequestId","driverId","status","version"])
    e["DriverLocation"]=obj({"driverId":UUID,"lat":s("number",format="double",minimum=-90,maximum=90),"lng":s("number",format="double",minimum=-180,maximum=180),"receivedAt":DT,"tripId":dict(s("string",format="uuid",nullable=True),maxLength=36)},["driverId","lat","lng","receivedAt"])
    e["Fare"]=obj({"id":UUID,"tripId":UUID,"priceVersionId":UUID,"distanceMeters":s("integer",minimum=0,nullable=True),"distanceSource":s("string",enum=["DRIVER_LOCATIONS","VERIFIED_BY_OPERATOR"],nullable=True),"amountVnd":s("integer",minimum=0,nullable=True),"status":s("string",enum=["PENDING","FARE_REVIEW_REQUIRED","FINALIZED"]),"version":VERSION},["id","tripId","priceVersionId","status","version"])
    e["Payment"]=obj({"id":UUID,"tripId":UUID,"method":s("string",enum=["CASH","SANDBOX"]),"status":s("string",enum=["UNPAID","PENDING","SUCCEEDED","FAILED","UNKNOWN"]),"paidAt":s("string",format="date-time",nullable=True),"version":VERSION},["id","tripId","method","status","version"])
    e["Notification"]=obj({"id":UUID,"recipientId":UUID,"eventId":UUID,"type":s("string",maxLength=64),"readAt":s("string",format="date-time",nullable=True)},["id","recipientId","eventId","type"])
    e["Rating"]=obj({"id":UUID,"tripId":UUID,"customerId":UUID,"score":s("integer",minimum=1,maximum=5),"comment":s("string",maxLength=500,nullable=True)},["id","tripId","customerId","score"])
    e["AuditRecord"]=obj({"id":UUID,"eventId":UUID,"actorId":s("string",format="uuid",nullable=True),"action":s("string",maxLength=80),"targetId":UUID,"beforeAfter":s("object",nullable=True,additionalProperties=True)},["id","eventId","action","targetId"])
    e["RideOffer"]=obj({"id":UUID,"rideRequestId":UUID,"driverId":UUID,"expiresAt":DT,"status":s("string",enum=["PENDING","ACCEPTED","DECLINED","EXPIRED","CANCELLED"]),"version":VERSION},["id","rideRequestId","driverId","expiresAt","status","version"])
    e["PaymentAttempt"]=obj({"id":UUID,"paymentId":UUID,"scenario":s("string",enum=["SUCCESS","FAIL","TIMEOUT_THEN_SUCCESS","TIMEOUT_THEN_FAIL","DUPLICATE_CALLBACK"]),"providerRef":s("string",maxLength=100,nullable=True),"status":s("string",enum=["PENDING","SUCCEEDED","FAILED","UNKNOWN"])},["id","paymentId","scenario","status"])
    e["StatusHistory"]=obj({"id":UUID,"aggregateType":s("string",enum=["RIDE_REQUEST","TRIP"]),"aggregateId":UUID,"fromStatus":s("string",maxLength=40,nullable=True),"toStatus":s("string",maxLength=40),"actorId":s("string",format="uuid",nullable=True),"at":DT},["id","aggregateType","aggregateId","toStatus","at"])
    e["PriceVersion"]=obj({"id":UUID,"vehicleTypeId":UUID,"baseFareVnd":s("integer",minimum=0),"includedMeters":s("integer",minimum=0),"perKmVnd":s("integer",minimum=0),"effectiveAt":DT,"status":s("string",enum=["DRAFT","ACTIVE","RETIRED"])},["id","vehicleTypeId","baseFareVnd","includedMeters","perKmVnd","effectiveAt","status"])
    e["AuditLog"]=obj({"id":UUID,"auditRecordId":UUID,"traceId":s("string",maxLength=64),"occurredAt":DT},["id","auditRecordId","traceId","occurredAt"])
    e["Incident"]=obj({"id":UUID,"tripId":UUID,"source":s("string",enum=["CUSTOMER","DRIVER","OPERATOR","SYSTEM"]),"reason":s("string",maxLength=500),"status":s("string",enum=["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]),"resolution":s("string",enum=["CONTINUE_TRIP","CANCEL_TRIP","TERMINATE_TRIP","FARE_REVIEW"],nullable=True),"version":VERSION},["id","tripId","source","reason","status","version"])
    e["DriverApplication"]=obj({"id":UUID,"driverId":UUID,"status":s("string",enum=["PENDING_REVIEW","APPROVED","REJECTED"]),"reviewerId":s("string",format="uuid",nullable=True),"reason":s("string",maxLength=500,nullable=True)},["id","driverId","status"])
    e["DriverDocument"]=obj({"id":UUID,"driverId":UUID,"type":s("string",enum=["GPLX","CCCD","VEHICLE_REGISTRATION"]),"fileKey":s("string",maxLength=255),"maskedValue":s("string",maxLength=80),"status":s("string",enum=["UPLOADED","VERIFIED","REJECTED","REPLACED"])},["id","driverId","type","fileKey","maskedValue","status"])
    e["Availability"]=obj({"driverId":UUID,"status":s("string",enum=["OFFLINE","ONLINE","ON_TRIP"]),"lastLocationAt":s("string",format="date-time",nullable=True),"version":VERSION},["driverId","status","version"])
    e["VehicleType"]=obj({"id":UUID,"code":s("string",maxLength=30,enum=["MOTORBIKE","CAR_4_SEAT"]),"name":s("string",maxLength=80),"active":s("boolean")},["id","code","name","active"])
    e["IdempotencyRecord"]=obj({"subjectId":UUID,"key":UUID,"payloadHash":s("string",maxLength=64),"response":s("object",additionalProperties=True),"expiresAt":DT},["subjectId","key","payloadHash","response","expiresAt"])
    e["OutboxEvent"]=obj({"id":UUID,"aggregateId":UUID,"eventType":s("string",maxLength=100),"payload":s("object",additionalProperties=True),"occurredAt":DT,"publishedAt":s("string",format="date-time",nullable=True)},["id","aggregateId","eventType","payload","occurredAt"])
    e["RefreshToken"]=obj({"id":UUID,"userId":UUID,"tokenHash":s("string",maxLength=255),"expiresAt":DT,"revokedAt":s("string",format="date-time",nullable=True)},["id","userId","tokenHash","expiresAt"])
    e["LoginAttempt"]=obj({"id":UUID,"phoneHash":s("string",maxLength=64),"ip":s("string",maxLength=45),"success":s("boolean"),"attemptedAt":DT},["id","phoneHash","ip","success","attemptedAt"])
    e["RateLimitCounter"]=obj({"scopeKey":s("string",maxLength=160),"windowStart":DT,"count":s("integer",minimum=0),"expiresAt":DT},["scopeKey","windowStart","count","expiresAt"])
    e["ReportProjection"]=obj({"metricDate":s("string",format="date"),"dimensions":s("object",additionalProperties=True),"metrics":s("object",additionalProperties=True),"sourceEventId":UUID},["metricDate","dimensions","metrics","sourceEventId"])
    return e

def schemas():
    d=entity_schemas()
    pwd=s("string",minLength=8,maxLength=128,pattern=r"^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$",writeOnly=True,example="CabPilot2026")
    d.update({
      "Error":obj({"code":s("string",example="VERSION_CONFLICT"),"message":s("string",example="Phiên bản dữ liệu không còn mới nhất")},["code","message"]),
      "RegisterRequest":obj({"phone":PHONE,"password":pwd,"fullName":s("string",maxLength=120,example="Nguyễn Minh An")},["phone","password","fullName"]),
      "UserResponse":obj({"id":UUID,"phone":PHONE,"roles":s("array",items=s("string"),example=["CUSTOMER"]),"status":s("string",example="ACTIVE")},["id","phone","roles","status"]),
      "DriverRegistrationRequest":obj({"phone":PHONE,"password":pwd,"fullName":s("string",maxLength=120),"vehicleTypeId":UUID,"plate":s("string",maxLength=15),"documents":s("array",minItems=3,items=obj({"type":s("string",enum=["GPLX","CCCD","VEHICLE_REGISTRATION"]),"fileKey":s("string",maxLength=255),"maskedValue":s("string",maxLength=80)},["type","fileKey","maskedValue"]))},["phone","password","fullName","vehicleTypeId","plate","documents"]),
      "LoginRequest":obj({"phone":PHONE,"password":pwd},["phone","password"]),
      "AuthTokens":obj({"accessToken":s("string",minLength=20),"refreshToken":s("string",minLength=20),"tokenType":s("string",enum=["Bearer"]),"expiresIn":s("integer",minimum=1)},["accessToken","refreshToken","tokenType","expiresIn"]),
      "RefreshRequest":obj({"refreshToken":s("string",minLength=20)},["refreshToken"]),
      "ProfilePatch":obj({"fullName":s("string",maxLength=120),"version":VERSION},["version"]),
      "Profile":obj({"userId":UUID,"fullName":s("string",maxLength=120),"version":VERSION},["userId","fullName","version"]),
      "AvailabilityRequest":obj({"status":s("string",enum=["ONLINE","OFFLINE"]),"version":VERSION},["status","version"]),
      "LocationRequest":obj({"lat":s("number",minimum=-90,maximum=90),"lng":s("number",minimum=-180,maximum=180),"receivedAt":DT,"tripId":s("string",format="uuid",nullable=True)},["lat","lng","receivedAt"]),
      "Location":obj({"driverId":UUID,"lat":s("number"),"lng":s("number"),"receivedAt":DT,"accepted":s("boolean")},["driverId","lat","lng","receivedAt","accepted"]),
      "InternalUserCreate":obj({"phone":PHONE,"fullName":s("string",maxLength=120),"role":s("string",enum=["OPERATOR","EXECUTIVE"]),"temporaryPassword":pwd},["phone","fullName","role","temporaryPassword"]),
      "AccountAction":obj({"reason":s("string",minLength=1,maxLength=500),"version":VERSION},["reason","version"]),
      "RideRequestCreate":obj({"pickup":POINT,"destination":POINT,"vehicleTypeId":UUID},["pickup","destination","vehicleTypeId"]),
      "Cancellation":obj({"reason":s("string",minLength=1,maxLength=500),"version":VERSION},["reason","version"]),
      "OfferDecision":obj({"decision":s("string",enum=["ACCEPT","DECLINE"]),"version":VERSION},["decision","version"]),
      "TripStatusUpdate":obj({"status":s("string",enum=["ARRIVED_AT_PICKUP","PICKED_UP","IN_PROGRESS","COMPLETED"]),"version":VERSION},["status","version"]),
      "RatingCreate":obj({"score":s("integer",minimum=1,maximum=5),"comment":s("string",maxLength=500)},["score"]),
      "FareEstimateRequest":obj({"pickup":POINT,"destination":POINT,"vehicleTypeId":UUID},["pickup","destination","vehicleTypeId"]),
      "FareEstimate":obj({"estimated":s("boolean",enum=[True]),"distanceMeters":s("integer",minimum=0),"quotedFareVnd":s("integer",minimum=0),"priceVersionId":UUID},["estimated","distanceMeters","quotedFareVnd","priceVersionId"]),
      "FareReviewRequest":obj({"distanceMeters":s("integer",minimum=1),"reason":s("string",minLength=1,maxLength=500),"version":VERSION},["distanceMeters","reason","version"]),
      "PaymentCreate":obj({"method":s("string",enum=["SANDBOX"]),"sandboxScenario":s("string",enum=["SUCCESS","FAIL","TIMEOUT_THEN_SUCCESS","TIMEOUT_THEN_FAIL","DUPLICATE_CALLBACK"])},["method","sandboxScenario"]),
      "CashConfirmation":obj({"received":s("boolean",enum=[True]),"version":VERSION},["received","version"]),
      "ProviderCallback":obj({"providerEventId":s("string",maxLength=100),"attemptId":UUID,"status":s("string",enum=["SUCCEEDED","FAILED","UNKNOWN"]),"occurredAt":DT},["providerEventId","attemptId","status","occurredAt"]),
      "NotificationPage":obj({"items":s("array",items={"$ref":"#/Notification"}),"page":s("integer",minimum=1,maximum=1000),"size":s("integer",minimum=1,maximum=100),"total":s("integer",minimum=0)},["items","page","size","total"]),
      "NotificationPatch":obj({"read":s("boolean",enum=[True]),"version":VERSION},["read","version"]),
      "SSE":s("string",example="id: 550e8400-e29b-41d4-a716-446655440000\nevent: TripStatusChanged\ndata: {\"tripId\":\"550e8400-e29b-41d4-a716-446655440001\",\"status\":\"IN_PROGRESS\"}\n\n"),
      "ActiveTripPage":obj({"items":s("array",items={"$ref":"#/Trip"}),"asOf":DT},["items","asOf"]),
      "IncidentCreate":obj({"reason":s("string",minLength=1,maxLength=500)},["reason"]),
      "IncidentUpdate":obj({"status":s("string",enum=["IN_PROGRESS","RESOLVED","CLOSED"]),"resolution":s("string",enum=["CONTINUE_TRIP","CANCEL_TRIP","TERMINATE_TRIP","FARE_REVIEW"]),"note":s("string",maxLength=500),"version":VERSION},["status","version"]),
      "Report":obj({"from":s("string",format="date-time"),"to":s("string",format="date-time"),"timezone":s("string",enum=["Asia/Ho_Chi_Minh"]),"tripCount":s("integer",minimum=0),"revenueVnd":s("integer",minimum=0),"completionRate":s("number",minimum=0,maximum=1,nullable=True),"cancellationRate":s("number",minimum=0,maximum=1,nullable=True),"findDriverRate":s("number",minimum=0,maximum=1,nullable=True),"acceptanceRate":s("number",minimum=0,maximum=1,nullable=True),"averageRating":s("number",minimum=1,maximum=5,nullable=True),"asOf":DT},["from","to","timezone","tripCount","revenueVnd","asOf"]),
      "Last-Event-ID":s("string"), "filters":obj({"status":s("string")}), "query":obj({"from":DT,"to":DT})
    })
    # SRS fixes DTO names but does not provide a field-by-field DTO dictionary.
    for name in ["RegisterRequest","UserResponse","DriverRegistrationRequest","LoginRequest","AuthTokens","RefreshRequest",
                 "ProfilePatch","Profile","AvailabilityRequest","LocationRequest","Location","InternalUserCreate",
                 "AccountAction","RideRequestCreate","Cancellation","OfferDecision","TripStatusUpdate","RatingCreate",
                 "FareEstimateRequest","FareEstimate","FareReviewRequest","PaymentCreate","CashConfirmation",
                 "ProviderCallback","NotificationPage","NotificationPatch","SSE","ActiveTripPage","IncidentCreate",
                 "IncidentUpdate","Report","Last-Event-ID","filters","query"]:
        d[name]["x-assumption"]=True
    return d

ERROR_NAMES={400:"BadRequest",401:"Unauthorized",403:"Forbidden",404:"NotFound",409:"Conflict",410:"Gone",422:"UnprocessableEntity",423:"Locked",429:"TooManyRequests"}
ERROR_DESC={400:"Yêu cầu không hợp lệ",401:"Chưa xác thực hoặc chữ ký không hợp lệ",403:"Không có quyền",404:"Không tìm thấy tài nguyên",409:"Xung đột trạng thái hoặc phiên bản",410:"Lời mời đã hết hiệu lực",422:"Dữ liệu không thỏa quy tắc nghiệp vụ",423:"Đăng nhập tạm khóa",429:"Vượt giới hạn yêu cầu"}

def manifest():
    out=[]
    for a in API_ROWS:
        aid,svc,meth,path,uc,roles,req,res,ok,errs,idem,rate,opid,file=a
        statuses=[ok]+errs
        if roles != ["Public"] and aid != "API-23" and 401 not in statuses: statuses.append(401)
        if rate and 429 not in statuses: statuses.append(429)
        out.append({"api_id":aid,"method":meth,"path":path,"uc":uc,"role":roles,"request":req or "—","response":res,"statuses":sorted(statuses),"idempotency":idem,"rate_limit":rate,"operation_id":opid,"file":file})
    return out

def example_for(name):
    ids={"id":"550e8400-e29b-41d4-a716-446655440000","vehicleTypeId":"550e8400-e29b-41d4-a716-446655440010"}
    trip_id="550e8400-e29b-41d4-a716-446655440001"; user_id="550e8400-e29b-41d4-a716-446655440002"; price_id="550e8400-e29b-41d4-a716-446655440003"
    ex={
      "RegisterRequest":{"phone":"+84901234567","password":"CabPilot2026","fullName":"Nguyễn Minh An"},
      "DriverRegistrationRequest":{"phone":"+84909876543","password":"Driver2026","fullName":"Trần Văn Bình","vehicleTypeId":ids["vehicleTypeId"],"plate":"59A1-12345","documents":[{"type":"GPLX","fileKey":"private/gplx-2026.pdf","maskedValue":"******1234"},{"type":"CCCD","fileKey":"private/cccd-2026.pdf","maskedValue":"******5678"},{"type":"VEHICLE_REGISTRATION","fileKey":"private/vehicle-2026.pdf","maskedValue":"59A1-*****"}]},
      "LoginRequest":{"phone":"+84901234567","password":"CabPilot2026"},"RefreshRequest":{"refreshToken":"refresh-token-pilot-2026-abcdef"},
      "ProfilePatch":{"fullName":"Nguyễn Minh An Updated","version":3},"AvailabilityRequest":{"status":"ONLINE","version":3},
      "LocationRequest":{"lat":10.776889,"lng":106.700806,"receivedAt":"2026-09-29T09:15:00+07:00"},
      "InternalUserCreate":{"phone":"+84905551234","fullName":"Lê Vận Hành","role":"OPERATOR","temporaryPassword":"Operator2026"},
      "AccountAction":{"reason":"Xác minh yêu cầu hỗ trợ CAB-2026-09","version":3},
      "RideRequestCreate":{"pickup":{"lat":10.776889,"lng":106.700806},"destination":{"lat":10.781234,"lng":106.695321},"vehicleTypeId":ids["vehicleTypeId"]},
      "Cancellation":{"reason":"Đổi kế hoạch","version":3},"OfferDecision":{"decision":"ACCEPT","version":3},
      "TripStatusUpdate":{"status":"ARRIVED_AT_PICKUP","version":3},"RatingCreate":{"score":5,"comment":"Tài xế lịch sự"},
      "FareEstimateRequest":{"pickup":{"lat":10.776889,"lng":106.700806},"destination":{"lat":10.781234,"lng":106.695321},"vehicleTypeId":ids["vehicleTypeId"]},
      "FareReviewRequest":{"distanceMeters":2001,"reason":"Đã đối chiếu hành trình GPS","version":3},
      "PaymentCreate":{"method":"SANDBOX","sandboxScenario":"TIMEOUT_THEN_SUCCESS"},"CashConfirmation":{"received":True,"version":3},
      "ProviderCallback":{"providerEventId":"evt-cab-20260929-001","attemptId":ids["id"],"status":"SUCCEEDED","occurredAt":"2026-09-29T09:30:00+07:00"},
      "NotificationPatch":{"read":True,"version":3},"IncidentCreate":{"reason":"Xe gặp sự cố kỹ thuật"},
      "IncidentUpdate":{"status":"RESOLVED","resolution":"CONTINUE_TRIP","note":"Đã hỗ trợ thay xe","version":3},
      "UserResponse":{"id":user_id,"phone":"+84901234567","roles":["CUSTOMER"],"status":"ACTIVE"},
      "DriverApplication":{"id":ids["id"],"driverId":user_id,"status":"PENDING_REVIEW"},
      "AuthTokens":{"accessToken":"access-token-pilot-2026-abcdefgh","refreshToken":"refresh-token-pilot-2026-abcdefgh","tokenType":"Bearer","expiresIn":900},
      "Profile":{"userId":user_id,"fullName":"Nguyễn Minh An","version":3},
      "Availability":{"driverId":user_id,"status":"ONLINE","lastLocationAt":"2026-09-29T09:15:00+07:00","version":3},
      "Location":{"driverId":user_id,"lat":10.776889,"lng":106.700806,"receivedAt":"2026-09-29T09:15:00+07:00","accepted":True},
      "User":{"id":user_id,"phone":"+84905551234","roles":["OPERATOR"],"status":"ACTIVE","mustChangePassword":True},
      "RideRequest":{"id":ids["id"],"customerId":user_id,"pickup":{"lat":10.776889,"lng":106.700806},"destination":{"lat":10.781234,"lng":106.695321},"vehicleTypeId":ids["vehicleTypeId"],"quotedFareVnd":11000,"priceVersionId":price_id,"status":"SEARCHING","version":3},
      "RideOffer":{"id":ids["id"],"rideRequestId":trip_id,"driverId":user_id,"expiresAt":"2026-09-29T09:15:20+07:00","status":"ACCEPTED","version":3},
      "Trip":{"id":trip_id,"rideRequestId":ids["id"],"driverId":user_id,"status":"IN_PROGRESS","distanceMeters":2001,"distanceSource":"DRIVER_LOCATIONS","version":3},
      "Rating":{"id":ids["id"],"tripId":trip_id,"customerId":user_id,"score":5,"comment":"Tài xế lịch sự"},
      "FareEstimate":{"estimated":True,"distanceMeters":2001,"quotedFareVnd":11000,"priceVersionId":price_id},
      "Fare":{"id":ids["id"],"tripId":trip_id,"priceVersionId":price_id,"distanceMeters":2001,"distanceSource":"DRIVER_LOCATIONS","amountVnd":11000,"status":"FINALIZED","version":3},
      "Payment":{"id":ids["id"],"tripId":trip_id,"method":"SANDBOX","status":"SUCCEEDED","paidAt":"2026-09-29T09:30:00+07:00","version":3},
      "NotificationPage":{"items":[],"page":1,"size":20,"total":12},
      "Notification":{"id":ids["id"],"recipientId":user_id,"eventId":price_id,"type":"TripStatusChanged","readAt":"2026-09-29T09:31:00+07:00"},
      "SSE":"id: 550e8400-e29b-41d4-a716-446655440000\nevent: TripStatusChanged\ndata: {\"tripId\":\"550e8400-e29b-41d4-a716-446655440001\",\"status\":\"IN_PROGRESS\"}\n\n",
      "ActiveTripPage":{"items":[],"asOf":"2026-09-29T09:32:00+07:00"},
      "Incident":{"id":ids["id"],"tripId":trip_id,"source":"DRIVER","reason":"Xe gặp sự cố kỹ thuật","status":"OPEN","version":3},
      "Report":{"from":"2026-09-01T00:00:00+07:00","to":"2026-10-01T00:00:00+07:00","timezone":"Asia/Ho_Chi_Minh","tripCount":120,"revenueVnd":1450000,"completionRate":0.91,"cancellationRate":0.09,"findDriverRate":0.88,"acceptanceRate":0.76,"averageRating":4.8,"asOf":"2026-09-29T09:32:00+07:00"}
    }
    return ex.get(name,{"id":ids["id"],"status":"ACTIVE","version":3})

def operation(row, external=False):
    aid,svc,meth,path,uc,roles,req,res,ok,errs,idem,rate,opid,file=row
    title,pre,post,fr,decs,brules=UC[uc]
    tag={"Identity&Driver":"Identity&Driver","Ride":"Ride","Billing":"Billing","Notification":"Notification","Operations&Reporting":"Operations&Reporting"}[svc]
    refbase="../_common/schemas.yaml#/" if external else "#/components/schemas/"
    errbase="../_common/errors.yaml#/" if external else "#/components/responses/"
    parbase="../_common/parameters.yaml#/" if external else "#/components/parameters/"
    op={"tags":[tag],"operationId":opid,"summary":title,"description":f"{uc}. Tiền điều kiện: {pre}. Hậu điều kiện thành công: {post}.","x-api-id":aid,"x-uc":uc,"x-roles":roles,"x-fr":fr,"x-dec":decs,"x-brule":brules,"x-idempotency":idem,"x-rate-limit":rate}
    if roles == ["Public"] or aid == "API-23": op["security"]=[]
    else: op["security"]=[{"bearerAuth":[]}]
    params=[]
    if "{id}" in path: params.append({"$ref":parbase+"ResourceId"})
    if idem in ("key","key+version"): params.append({"$ref":parbase+"IdempotencyKey"})
    if aid=="API-23": params.append({"$ref":parbase+"ProviderSignature"})
    if aid=="API-26": params.append({"$ref":parbase+"LastEventId"})
    if aid in ("API-24","API-27"): params += [{"$ref":parbase+"Page"},{"$ref":parbase+"Size"}]
    if aid=="API-27": params.append({"$ref":parbase+"TripStatusFilter"})
    if aid=="API-30": params += [{"$ref":parbase+"From"},{"$ref":parbase+"To"}]
    if params: op["parameters"]=params
    if req and req not in ("Last-Event-ID","filters","query"):
        op["requestBody"]={"required":True,"content":{"application/json":{"schema":{"$ref":refbase+req},"example":example_for(req)}}}
    ctype="text/event-stream" if aid=="API-26" else "application/json"
    success={"description":post,"content":{ctype:{"schema":{"$ref":refbase+res},"example":example_for(res)}}}
    statuses=[ok]+errs
    if roles != ["Public"] and aid != "API-23" and 401 not in statuses: statuses.append(401)
    if rate and 429 not in statuses: statuses.append(429)
    responses={str(ok):success}
    for st in sorted(set(statuses)-{ok}): responses[str(st)]={"$ref":errbase+ERROR_NAMES[st]}
    op["responses"]=responses
    return op

def shared_components():
    params={
      "IdempotencyKey":{"name":"Idempotency-Key","in":"header","required":True,"description":"UUID giữ trong 24 giờ theo DEC-34.","schema":s("string",format="uuid"),"example":"550e8400-e29b-41d4-a716-446655440000"},
      "ResourceId":{"name":"id","in":"path","required":True,"schema":s("string",format="uuid"),"example":"550e8400-e29b-41d4-a716-446655440001"},
      "ProviderSignature":{"name":"X-Signature","in":"header","required":True,"description":"Chữ ký HMAC callback theo DEC-27.","schema":s("string",minLength=32),"example":"sha256=7e9d8f6c5b4a3210dcbafedcba0123456789abcd","x-assumption":True},
      "LastEventId":{"name":"Last-Event-ID","in":"header","required":False,"schema":s("string",format="uuid"),"example":"550e8400-e29b-41d4-a716-446655440002"},
      "Page":{"name":"page","in":"query","required":False,"schema":s("integer",minimum=1,maximum=1000,default=1),"example":1,"x-assumption":True},
      "Size":{"name":"size","in":"query","required":False,"schema":s("integer",minimum=1,maximum=100,default=20),"example":20,"x-assumption":True},
      "TripStatusFilter":{"name":"status","in":"query","required":False,"schema":s("string",enum=["ASSIGNED","ARRIVED_AT_PICKUP","IN_PROGRESS"]),"example":"IN_PROGRESS"},
      "From":{"name":"from","in":"query","required":True,"description":"Đầu kỳ bao gồm, Asia/Ho_Chi_Minh.","schema":DT,"example":"2026-09-01T00:00:00+07:00"},
      "To":{"name":"to","in":"query","required":True,"description":"Cuối kỳ loại trừ, tối đa 366 ngày.","schema":DT,"example":"2026-10-01T00:00:00+07:00"},
    }
    responses={}
    for code,name in ERROR_NAMES.items():
        r={"description":ERROR_DESC[code],"content":{"application/json":{"schema":{"$ref":"./schemas.yaml#/Error"},"example":{"code":name.upper(),"message":ERROR_DESC[code]}}}}
        if code==429: r["headers"]={"Retry-After":{"description":"Số giây chờ trước khi thử lại.","schema":s("integer",minimum=1),"example":60}}
        responses[name]=r
    return params,responses

def dump(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(yaml.safe_dump(data,allow_unicode=True,sort_keys=False,width=120),encoding="utf-8")

def make_monolith():
    sch=schemas(); params,errors=shared_components()
    def internalize_schema_refs(node):
        if isinstance(node,dict):
            if isinstance(node.get("$ref"),str) and node["$ref"].startswith("#/"):
                node["$ref"]="#/components/schemas/"+node["$ref"][2:]
            for value in node.values(): internalize_schema_refs(value)
        elif isinstance(node,list):
            for value in node: internalize_schema_refs(value)
    internalize_schema_refs(sch)
    # Internal component responses must point to the internal Error schema.
    mon_errors=copy.deepcopy(errors)
    for r in mon_errors.values(): r["content"]["application/json"]["schema"]["$ref"]="#/components/schemas/Error"
    paths={}
    for row in API_ROWS: paths.setdefault(row[3],{})[row[2].lower()]=operation(row,False)
    doc={"openapi":"3.0.3","info":{"title":"CAB System API","version":"0.1.0-pilot","description":"API cho CAB System — đồ án 7 tuần. Baseline theo DEC-01–38 trong SRS."},"servers":[{"url":"https://api.cab-system.local/api/v1","description":"Pilot environment (mock)"}],"tags":[{"name":n,"description":f"API thuộc service {n}."} for n in ["Identity&Driver","Ride","Billing","Notification","Operations&Reporting"]],"paths":paths,"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}},"schemas":sch,"responses":mon_errors,"parameters":params}}
    dump(ROOT/"_manifest.yaml",manifest()); dump(ROOT/"openapi.yaml",doc)
    dump(Path(tempfile.gettempdir())/"openapi.monolith.yaml",doc)

def make_split():
    sch=schemas(); params,errors=shared_components()
    dump(ROOT/"_common/schemas.yaml",sch); dump(ROOT/"_common/parameters.yaml",params); dump(ROOT/"_common/errors.yaml",errors)
    groups={}
    for row in API_ROWS: groups.setdefault(row[-1],{})[row[3]]={row[2].lower():operation(row,True)}
    for file,data in groups.items(): dump(ROOT/file,data)
    pathrefs={}
    for row in API_ROWS:
        pointer=row[3].replace("~","~0").replace("/","~1")
        pathrefs[row[3]]={"$ref":f"./{row[-1]}#/{pointer}"}
    doc={"openapi":"3.0.3","info":{"title":"CAB System API","version":"0.1.0-pilot","description":"API cho CAB System — đồ án 7 tuần. Baseline theo DEC-01–38 trong SRS."},"servers":[{"url":"https://api.cab-system.local/api/v1","description":"Pilot environment (mock)"}],"tags":[{"name":n,"description":f"API thuộc service {n}."} for n in ["Identity&Driver","Ride","Billing","Notification","Operations&Reporting"]],"paths":pathrefs,"components":{"securitySchemes":{"bearerAuth":{"type":"http","scheme":"bearer","bearerFormat":"JWT"}},"schemas":{n:{"$ref":f"./_common/schemas.yaml#/{n}"} for n in sch},"responses":{n:{"$ref":f"./_common/errors.yaml#/{n}"} for n in errors},"parameters":{n:{"$ref":f"./_common/parameters.yaml#/{n}"} for n in params}}}
    dump(ROOT/"openapi.yaml",doc)

if __name__=="__main__":
    mode=sys.argv[1] if len(sys.argv)>1 else "split"
    if mode=="monolith": make_monolith()
    elif mode=="split": make_split()
    else: raise SystemExit("Usage: build_openapi.py [monolith|split]")
