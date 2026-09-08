import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Query,
  Patch,
  Delete,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { CameraService } from "./camera.service";
import { CreateCameraDto } from "./dto/create-camera.dto";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { UpdateCameraDto } from "./dto/update-camera.dto";

@ApiTags("Cameras")
@Controller("cameras")
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new camera" })
  async create(@Body() createCameraDto: CreateCameraDto) {
    const data = await this.cameraService.create(createCameraDto);
    return {
      message: "Camera registered successfully",
      data,
    }; 
  }

  @Get("all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get list of cameras with pagination and search" })
  async findAll(@Query() paginationQueryDto: PaginationQueryDto) {
    const result = await this.cameraService.findAll(paginationQueryDto);
    
    return {
      message: "Get camera list successfully",
      data: result.items,
      meta: result.pagination,
    };
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get camera details by ID" })
  async findOne(@Param("id") id: string) {
    const data = await this.cameraService.findById(id);
    return {
      message: "Camera details retrieved successfully",
      data,
    };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update camera details by ID" })
  async update(
    @Param("id") id: string,
    @Body() updateCameraDto: UpdateCameraDto,
  ) {
    const data = await this.cameraService.update(id, updateCameraDto);
    return {
      message: "Camera updated successfully",
      data,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete camera by ID" })
  async remove(@Param("id") id: string) {
    const data = await this.cameraService.remove(id);
    return {
      message: "Camera deleted successfully",
      data,
    };
  }
}
