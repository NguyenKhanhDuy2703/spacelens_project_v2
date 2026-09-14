import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import {AllExceptionsFilter} from "./common/filters/http-exception.filter"
import setupSwagger from "./configs/swagger.config";
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const prefixApi = configService.get<string>('app.prefixApi')
  const port = configService.get<number>('PORT') || 3000;
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  if(prefixApi){
    app.setGlobalPrefix(prefixApi)
  }
  // 1. Enable CORS
  app.enableCors();

  // 2. Global automated validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 3. Global central error & logging filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // 4. Global response normalization interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // 5. Configure Swagger API documentation
  let swaggerPath  = ''
  if(nodeEnv === 'development'){
    swaggerPath = setupSwagger(app);
  }
  // 6. Enable graceful shutdown
  app.enableShutdownHooks();

  // 7. Listen on port
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`SpaceLens Backend (NestJS) running in "${nodeEnv}" mode`);
  logger.log(`Server listening at: http://localhost:${port}`);
  if (swaggerPath) {
    logger.log(`Swagger API Docs:   http://localhost:${port}/${swaggerPath}`);
  }
  logger.log(`=======================================================`);
}

bootstrap();
