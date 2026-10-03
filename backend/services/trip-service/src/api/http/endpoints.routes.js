export const serviceEndpoints = [
  { method: "GET", path: "/health", access: "health", description: "Liveness của trip-service" },
  { method: "GET", path: "/ready", access: "internal", description: "Readiness và trạng thái dependency" },
  { method: "GET", path: "/endpoints", access: "metadata", description: "Danh mục endpoint của service" },
  { method: "GET", path: "/trips/:id", access: "public", roles: ["CUSTOMER(owner)", "DRIVER(owner)", "ADMIN"], description: "Xem chuyến đi" },
  { method: "PATCH", path: "/trips/:id/status", access: "public", roles: ["DRIVER(owner)"], description: "Cập nhật trạng thái chuyến đúng trình tự" },
  { method: "PUT", path: "/trips/:id/location", access: "public", roles: ["DRIVER(owner)"], description: "Cập nhật vị trí khi chuyến đang chạy" },
  { method: "POST", path: "/trips/:id/cancel", access: "public", roles: ["CUSTOMER(owner)", "DRIVER(owner)"], description: "Hủy chuyến kèm lý do" },
  { method: "POST", path: "/trips/:id/reviews", access: "public", roles: ["CUSTOMER(owner)"], idempotent: true, description: "Đánh giá chuyến đã hoàn thành" },
  { method: "GET", path: "/trips/:id/review", access: "public", roles: ["CUSTOMER(owner)", "DRIVER(owner)", "ADMIN"], description: "Xem đánh giá của chuyến" },
  { method: "POST", path: "/internal/trips", access: "internal", description: "Tạo trip từ offer được chấp nhận" },
  { method: "GET", path: "/internal/trips/:id/payable", access: "internal", description: "Lấy thông tin trip có thể thanh toán" },
  { method: "POST", path: "/internal/trips/:id/paid", access: "internal", description: "Đánh dấu trip đã thanh toán" },
];
