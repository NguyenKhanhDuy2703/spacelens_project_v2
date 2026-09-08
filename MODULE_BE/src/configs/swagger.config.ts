import { INestApplication } from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export default function setupSwagger(app: INestApplication) {
    const configService = app.get(ConfigService);
    const prefixApi = configService.get<string>('app.prefixApi')
    const swaggerPath = configService.get<string>('app.swaggerPath')
    const fullPath = prefixApi+"/"+swaggerPath
    const swaggerConfig = new DocumentBuilder()
        .setTitle('SpaceLens Backend API')
        .setDescription(
            'API specification for SpaceLens Spatial Analytics & Monitoring System (NestJS Architecture)',
        )
        .setVersion('2.0.0')
        .addTag('Cameras', 'Camera registration, RTSP streams, and lifecycle management')
        .addTag('Health', 'Server health and liveness checks')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(fullPath, app, document);
    return fullPath
}