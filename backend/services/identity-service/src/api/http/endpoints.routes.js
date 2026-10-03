export const serviceEndpoints = [
  { method: "GET", path: "/health", access: "health", description: "Liveness của identity-service" },
  { method: "GET", path: "/ready", access: "internal", description: "Readiness và trạng thái dependency" },
  { method: "GET", path: "/endpoints", access: "metadata", description: "Danh mục endpoint của service" },
  { method: "POST", path: "/auth/register", access: "public", roles: ["PUBLIC"], idempotent: true, description: "Đăng ký tài khoản khách hàng" },
  { method: "POST", path: "/auth/login", access: "public", roles: ["PUBLIC"], description: "Đăng nhập bằng email hoặc số điện thoại" },
  { method: "POST", path: "/internal/accounts/drivers", access: "internal", description: "Tạo tài khoản tài xế chờ duyệt" },
  { method: "POST", path: "/internal/accounts/:id/status", access: "internal", description: "Đồng bộ trạng thái tài khoản tài xế" },
];
