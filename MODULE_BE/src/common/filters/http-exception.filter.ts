import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger, 
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  trace?: string | null;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // 2. Khởi tạo logger riêng cho Filter này
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>(); // Lấy request để biết user gọi URL và Method nào

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception?.message || 'Internal server error';
    const trace = exception?.stack || null;

    // 3. LOG RA TERMINAL:
    const logMessage = `[${request.method}] ${request.url} - Status: ${statusCode} - Error: ${message}`;
    if (statusCode >= 500) {
      this.logger.error(logMessage, trace); // Lỗi server: In màu ĐỎ kèm trace
    } else {
      this.logger.warn(logMessage); // Lỗi người dùng (400, 404, 409): In màu VÀNG cảnh báo
    }

    // 4. Trả response về cho client
    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      trace,
      timestamp: new Date().toISOString(),
    });
  }
}
