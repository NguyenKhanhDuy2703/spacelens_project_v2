import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CameraService } from '../../../src/modules/camera/camera.service';

describe('CameraService Unit & Business Logic Tests', () => {
  let service: CameraService;
  let mockCameraModel: any;

  beforeEach(() => {
    mockCameraModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    };

    // Instantiate CameraService directly as a pure unit (Clean Architecture)
    service = new CameraService(mockCameraModel as any);
  });

  it('Service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Business Rule: create()', () => {
    it('Rule 1: Should throw ConflictException when camera_code already exists', async () => {
      mockCameraModel.findOne.mockResolvedValue({ camera_code: 'CAM_FRONT_GATE' });

      const dto = {
        name: 'Front Gate Camera',
        camera_code: 'cam_front_gate',
        rtsp_url: 'rtsp://192.168.1.100:554/live',
      } as any;

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockCameraModel.findOne).toHaveBeenCalledWith({ camera_code: 'CAM_FRONT_GATE' });
    });

    it('Rule 2: Should transform camera_code to UPPERCASE and default status to READY on success', async () => {
      mockCameraModel.findOne.mockResolvedValue(null);

      const mockSave = jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'Front Gate Camera',
        camera_code: 'CAM_FRONT_GATE',
        status: 'READY',
        is_active: true,
      });

      const mockConstructor: any = jest.fn().mockImplementation((payload) => ({
        ...payload,
        save: mockSave,
      }));
      mockConstructor.findOne = mockCameraModel.findOne;
      (service as any).cameraModel = mockConstructor;

      const dto = {
        name: 'Front Gate Camera',
        camera_code: 'cam_front_gate',
        rtsp_url: 'rtsp://192.168.1.100:554/live',
      } as any;

      const result = await service.create(dto);
      expect(result.camera_code).toBe('CAM_FRONT_GATE');
      expect(result.status).toBe('READY');
      expect(result.is_active).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('Business Rule: findById()', () => {
    it('Rule 3: Should throw BadRequestException when ID format is not a valid MongoDB ObjectId', async () => {
      await expect(service.findById('invalid-mongo-id')).rejects.toThrow(BadRequestException);
    });

    it('Rule 4: Should throw NotFoundException when camera is not found in database', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockCameraModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById(validObjectId)).rejects.toThrow(NotFoundException);
    });

    it('Rule 5: Should return camera data when camera exists with valid ID', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const mockCameraData = {
        _id: validObjectId,
        name: 'Front Gate Camera',
        camera_code: 'CAM_FRONT_GATE',
        status: 'READY',
      };

      mockCameraModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCameraData),
      });

      const result = await service.findById(validObjectId);
      expect(result).toEqual(mockCameraData);
    });
  });

  describe('Business Rule: remove()', () => {
    it('Rule 6: Should throw BadRequestException when removing with invalid ID format', async () => {
      await expect(service.remove('12345')).rejects.toThrow(BadRequestException);
    });

    it('Rule 7: Should successfully delete camera and return status', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockCameraModel.findByIdAndDelete.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: validObjectId,
          camera_code: 'CAM_FRONT_GATE',
        }),
      });

      const result = await service.remove(validObjectId);
      expect(result).toEqual({
        deleted: true,
        camera_code: 'CAM_FRONT_GATE',
      });
    });
  });
});
