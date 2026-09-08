import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ResolutionDto {
  @ApiProperty({ example: 1920, description: 'Frame width in pixels' })
  @IsNumber()
  @Min(1)
  width: number;

  @ApiProperty({ example: 1080, description: 'Frame height in pixels' })
  @IsNumber()
  @Min(1)
  height: number;
}

export class CreateCameraDto {
  @ApiProperty({ example: 'CAM-01-ENTRANCE', description: 'Unique camera code identifier' })
  @IsString()
  @IsNotEmpty({ message: 'camera_code must not be empty' })
  camera_code: string;

  @ApiProperty({ example: 'Main Entrance Camera', description: 'Camera display name' })
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  name: string;

  @ApiPropertyOptional({ example: 'Monitors main entry and exit zone' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'LOC_01', description: 'Location / branch identifier' })
  @IsString()
  @IsNotEmpty({ message: 'location_id must not be empty' })
  location_id: string;

  @ApiPropertyOptional({ example: 'FLOOR_01', description: 'Floor identifier' })
  @IsString()
  @IsOptional()
  floor_id?: string;

  @ApiProperty({
    example: 'RTSP',
    enum: ['RTSP', 'VIDEO_FILE', 'WEBCAM'],
    description: 'Video feed source type',
  })
  @IsEnum(['RTSP', 'VIDEO_FILE', 'WEBCAM'])
  stream_source_type: 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';

  @ApiProperty({
    example: 'rtsp://admin:password123@192.168.1.100:554/live',
    description: 'RTSP feed stream URL',
  })
  @IsString()
  @IsNotEmpty({ message: 'url_rtsp must not be empty' })
  url_rtsp: string;

  @ApiProperty({ type: ResolutionDto, description: 'Frame resolution dimensions' })
  @ValidateNested()
  @Type(() => ResolutionDto)
  resolution: ResolutionDto;

  @ApiPropertyOptional({ example: 30, description: 'Target frame rate (FPS)', default: 30 })
  @IsNumber()
  @Min(1)
  @Max(120)
  @IsOptional()
  fps?: number = 30;

  @ApiPropertyOptional({
    example: 'H264',
    enum: ['H264', 'H265', 'MJPEG'],
    default: 'H264',
  })
  @IsEnum(['H264', 'H265', 'MJPEG'])
  @IsOptional()
  codec?: 'H264' | 'H265' | 'MJPEG' = 'H264';

  @ApiPropertyOptional({
    example: 'ANGLED',
    enum: ['CEILING', 'WALL', 'ANGLED'],
    default: 'ANGLED',
  })
  @IsEnum(['CEILING', 'WALL', 'ANGLED'])
  @IsOptional()
  orientation?: 'CEILING' | 'WALL' | 'ANGLED' = 'ANGLED';

  @ApiPropertyOptional({ example: 'READY', enum: ['INACTIVE', 'READY'] })
  @IsEnum(['INACTIVE', 'READY'])
  @IsOptional()
  status?: 'INACTIVE' | 'READY' = 'READY';
}
