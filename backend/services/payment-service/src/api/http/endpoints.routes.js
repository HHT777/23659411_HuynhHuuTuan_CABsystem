export const serviceEndpoints = [
  { method: "GET", path: "/health", access: "health", description: "Liveness của payment-service" },
  { method: "GET", path: "/ready", access: "internal", description: "Readiness và trạng thái dependency" },
  { method: "GET", path: "/endpoints", access: "metadata", description: "Danh mục endpoint của service" },
  { method: "POST", path: "/payments", access: "public", roles: ["CUSTOMER(owner)"], idempotent: true, description: "Khởi tạo thanh toán online" },
  { method: "GET", path: "/payments/:id", access: "public", roles: ["CUSTOMER(owner)", "ADMIN"], description: "Xem trạng thái thanh toán" },
  { method: "POST", path: "/payments/callback", access: "public", roles: ["PAYMENT_PROVIDER(HMAC)"], description: "Nhận callback có chữ ký từ nhà cung cấp" },
  { method: "POST", path: "/payments/:id/sandbox-confirm", access: "public", roles: ["CUSTOMER(owner)"], description: "Xác nhận thanh toán trong sandbox" },
];
