import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from "./configs/app.config";
import databaseConfig from "./configs/database.config";
import CameraModule  from "./modules/camera/camera.module";
import {AppController} from './app.controller';
import frontendConfig from './configs/frontend.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
      load: [appConfig, databaseConfig , frontendConfig],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbConf = config.get('database')
        return {
          uri: dbConf.mongodbUri,
          maxPoolSize: dbConf.maxPoolSize,
          minPoolSize: dbConf.minPoolSize,
          maxIdleTimeMS: dbConf.maxIdleTimeMS,
          maxConnectingTimeMS: dbConf.maxConnectingTimeMS
        }
      }
    }),
    CameraModule,
  ],
  controllers:[AppController],
  providers:[],
})
export class AppModule {}