export const serviceEndpoints = [
  { method: "GET", path: "/health", access: "health", description: "Liveness của notification-service" },
  { method: "GET", path: "/ready", access: "internal", description: "Readiness và trạng thái dependency" },
  { method: "GET", path: "/endpoints", access: "metadata", description: "Danh mục endpoint của service" },
  { method: "GET", path: "/notifications", access: "public", roles: ["CUSTOMER(owner)", "DRIVER(owner)"], description: "Liệt kê thông báo của người dùng" },
  { method: "PATCH", path: "/notifications/:id/read", access: "public", roles: ["CUSTOMER(owner)", "DRIVER(owner)"], description: "Đánh dấu thông báo đã đọc" },
  { method: "POST", path: "/internal/notifications", access: "internal", description: "Lưu thông báo từ service nghiệp vụ" },
];
