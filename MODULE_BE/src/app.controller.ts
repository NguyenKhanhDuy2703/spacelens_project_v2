import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('api/v1')
export class AppController {
  @Get('healthy')
  @ApiOperation({ summary: 'Check system health status' })
  getHealth() {
    return {
      message: 'System is running normally',
      data: { status: 'healthy', uptime: process.uptime() },
    };
  }
}
