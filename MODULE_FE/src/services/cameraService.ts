import { Camera, CreateCameraPayload, UpdateCameraPayload, CameraQueryParams } from '@/types/camera.types';
import { ApiResponse } from '@/types/api.types';
import { axiosInstance } from './index';

/**
 * CAMERA SERVICE: Xử lý toàn bộ HTTP request liên quan đến Camera
 */

// 1. Lấy danh sách camera (hỗ trợ phân trang, tìm kiếm, lọc status/location)
// Endpoint: GET /cameras/all
export async function fetchCameras(params?: CameraQueryParams): Promise<ApiResponse<Camera[]>> {
  const response = await axiosInstance.get<ApiResponse<Camera[]>>('/cameras/all', {
    params,
  });
  return response.data;
}

// 2. Lấy thông tin chi tiết một camera theo ID
// Endpoint: GET /cameras/:id
export async function fetchCameraById(id: string): Promise<ApiResponse<Camera>> {
  const response = await axiosInstance.get<ApiResponse<Camera>>(`/cameras/${id}`);
  return response.data;
}

// 3. Tạo/Đăng ký mới một camera
// Endpoint: POST /cameras
export async function createCamera(payload: CreateCameraPayload): Promise<ApiResponse<Camera>> {
  const response = await axiosInstance.post<ApiResponse<Camera>>('/cameras', payload);
  return response.data;
}

// 4. Cập nhật thông tin camera
// Endpoint: PATCH /cameras/:id
export async function updateCamera(id: string, payload: UpdateCameraPayload): Promise<ApiResponse<Camera>> {
  const response = await axiosInstance.patch<ApiResponse<Camera>>(`/cameras/${id}`, payload);
  return response.data;
}

// 5. Xóa camera theo ID
// Endpoint: DELETE /cameras/:id
export async function deleteCamera(id: string): Promise<ApiResponse<{ message: string }>> {
  const response = await axiosInstance.delete<ApiResponse<{ message: string }>>(`/cameras/${id}`);
  return response.data;
}
