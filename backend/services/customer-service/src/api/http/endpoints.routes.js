export const serviceEndpoints = [
  { method: "GET", path: "/health", access: "health", description: "Liveness của customer-service" },
  { method: "GET", path: "/ready", access: "internal", description: "Readiness và trạng thái dependency" },
  { method: "GET", path: "/endpoints", access: "metadata", description: "Danh mục endpoint của service" },
  { method: "GET", path: "/customers/:id", access: "public", roles: ["CUSTOMER(owner)", "ADMIN"], description: "Lấy hồ sơ khách hàng" },
  { method: "POST", path: "/internal/customers", access: "internal", description: "Tạo hồ sơ khách hàng từ identity-service" },
  { method: "GET", path: "/internal/customers/:id/active-trip", access: "internal", description: "Tra cứu chuyến đang hoạt động của khách hàng" },
];
