import axios from 'axios';
import {ENV_CONFIG} from "../configs/env.config"
export  const axiosInstance = axios.create({
  baseURL: ENV_CONFIG.API_BASE_URL,
  timeout: ENV_CONFIG.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

// Interceptor: Trước mỗi request, tự động lấy token mới nhất từ localStorage
// Interceptor: Xử lý response / bắt lỗi chung (ví dụ 401 Unauthorized)