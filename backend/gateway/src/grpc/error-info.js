export function errorInfo(error) {
  return { message: error?.message ?? "upstream error" };
}
