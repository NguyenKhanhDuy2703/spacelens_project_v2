import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Camera, CameraDocument } from './schemas/camera.schema';
import { CreateCameraDto } from './dto/create-camera.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name);

  constructor(
    @InjectModel(Camera.name)
    private readonly cameraModel: Model<CameraDocument>,
  ) {}

  async create(createCameraDto: CreateCameraDto): Promise<Camera> {
    const existing = await this.cameraModel.findOne({
      camera_code: createCameraDto.camera_code.toUpperCase(),
    });

    if (existing) {
      throw new ConflictException(
        `The code camera ${createCameraDto.camera_code} already exists `
      );
    }

 
    const createdCamera = new this.cameraModel({
      ...createCameraDto,
      camera_code: createCameraDto.camera_code.toUpperCase(),
      status: createCameraDto.status || 'READY',
      is_active: true,
    });

    
    const savedCamera = await createdCamera.save();
    this.logger.log(`Create Camera is success: ${savedCamera.camera_code}`);

    return savedCamera;
  }

  async findAll(paginationQueryDto: PaginationQueryDto) {
    const page = Number(paginationQueryDto.page) || 1;
    const limit = Number(paginationQueryDto.limit) || 10;
    const skip = (page - 1) * limit;

    const sort = paginationQueryDto.sort || 'created_at';
    const sortOrder = paginationQueryDto.sortOrder?.toLowerCase() === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sort]: sortOrder };

    const filter: any = {};

    if (paginationQueryDto.search) {
      const cleanSearch = paginationQueryDto.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { camera_code: { $regex: cleanSearch, $options: 'i' } },
        { name: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    if (paginationQueryDto.status) {
      filter.status = paginationQueryDto.status;
    }

    const [items, totalItems] = await Promise.all([
      this.cameraModel
        .find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.cameraModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findById(id: string): Promise<Camera> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid camera ID format: '${id}'`);
    }

    const camera = await this.cameraModel.findById(id).lean();
    if (!camera) {
      throw new NotFoundException(`Camera not found with ID '${id}'`);
    }

    return camera;
  }

  async update(id: string, updateCameraDto: UpdateCameraDto): Promise<Camera> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid camera ID format: '${id}'`);
    }

    const camera = await this.cameraModel.findById(id);
    if (!camera) {
      throw new NotFoundException(`Camera not found with ID '${id}'`);
    }

    if (updateCameraDto.camera_code) {
      const formattedCode = updateCameraDto.camera_code.toUpperCase();
      const duplicate = await this.cameraModel.findOne({
        camera_code: formattedCode,
        _id: { $ne: id },
      });

      if (duplicate) {
        throw new ConflictException(
          `Camera code '${updateCameraDto.camera_code}' already exists in the system`,
        );
      }
    }

    const updateData: any = { ...updateCameraDto };
    if (updateCameraDto.camera_code) {
      updateData.camera_code = updateCameraDto.camera_code.toUpperCase();
    }

    const updated = await this.cameraModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .lean();

    this.logger.log(`Updated camera successfully: ${updated.camera_code}`);
    return updated;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid camera ID format: '${id}'`);
    }

    const deleted = await this.cameraModel.findByIdAndDelete(id).lean();
    if (!deleted) {
      throw new NotFoundException(`Camera not found with ID '${id}'`);
    }

    this.logger.log(`Deleted camera successfully: ${deleted.camera_code}`);
    return {
      deleted: true,
      camera_code: deleted.camera_code,
    };
  }
}

