// src/services/api.js (ĐÃ CHỈNH SỬA)
import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:4000/api",
  headers: { "Content-Type": "application/json" },
});

// ⭐ Interceptor: Tự động đính kèm Token ⭐
apiClient.interceptors.request.use((config) => {
  // Thay thế "jwtToken" bằng tên khóa token bạn dùng khi đăng nhập/lưu token.
  // Ví dụ: Nếu bạn lưu bằng localStorage.setItem("token", ...)
  const token = localStorage.getItem("token"); // <--- KHẢ NĂNG CAO CẦN SỬA ĐỔI Ở ĐÂY

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ... (phần còn lại của apiClient.interceptors.response.use giữ nguyên)

export default apiClient;
