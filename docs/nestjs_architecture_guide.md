# SpaceLens Backend: Cẩm Nang Kiến Trúc NestJS & Hướng Dẫn Chuyển Đổi

> **Tài liệu tham chiếu:** `DOC-ARCH-NESTJS-01`  
> **Dự án:** SpaceLens Backend Monolith (`MODULE_BE :3000`)  
> **Mục đích:** Giải thích chi tiết các khái niệm NestJS, đối chiếu với Express cũ, làm rõ cơ chế Interceptor/Filter trong `common/`, và giải thích vì sao gộp Domain vào Module.

---

## 1. Tổng Quan: Vì Sao Chuyển Từ Express Sang NestJS?

| Tiêu chí | Express + TS (Cũ) | NestJS (Mới) |
| :--- | :--- | :--- |
| **Kiến trúc** | Tự do, thủ công, dễ bị lộn xộn khi phình to | Chuẩn hóa Enterprise (Module - Controller - Service) |
| **Validate dữ liệu** | Phải tự viết middleware + schema riêng | Tự động 100% qua `ValidationPipe` + DTO Class |
| **Quản lý Service** | Phải tự `new CameraService()` khắp nơi | **Dependency Injection (DI)** tự động tiêm service |
| **Tài liệu API** | Viết JSON/YAML tài liệu thủ công rất mất thời gian | **Swagger UI tự động sinh** tại `/api/docs` |
| **Bắt lỗi & Logging** | Tự bọc `asyncHandler` + viết `AppError` | Có sẵn `HttpException` + `AllExceptionsFilter` toàn cục |
| **Định dạng phản hồi** | Mỗi controller phải nhớ gọi `ApiResponse.success` | `TransformInterceptor` tự động bọc chuẩn hóa |

---

## 2. Giải Thích "Tại Sao Không Tách Domain Riêng Và Module Riêng?"

Nhiều người mới tiếp cận thường thắc mắc: *Vì sao trước đây có cả `src/domains/` và `src/modules/`? Có cần tách riêng một tính năng thành 2 nơi không?*

### 2.1 Bản chất: Domain vs Module
* **Domain (Miền nghiệp vụ):** Là bài toán thực tế, quy tắc nghiệp vụ đời thực (ví dụ: Camera RTSP mã hóa ra sao, quy tắc vùng cấm polygon thế nào). Về lý thuyết, Domain là độc lập với framework.
* **Module (Khối đóng gói kỹ thuật):** Là khái niệm cốt lõi của NestJS. Module giống như "chiếc hộp điều phối", chịu trách nhiệm kết nối Controller, Service, Database Model và tiêm phụ thuộc (Dependency Injection) để server vận hành.

### 2.2 Thực tế trong SpaceLens & Lý do dọn dẹp
* Thư mục `src/domains/` trước đây là **mã nguồn cũ viết bằng Express**.
* Trong NestJS, chuẩn thiết kế tối ưu nhất được khuyến nghị là **Feature Module Pattern**: **Gộp cả Domain Logic lẫn Module Kỹ thuật vào cùng một nơi:** `src/modules/<tên_tính_năng>/`.
* Toàn bộ mã nguồn cũ trong `src/domains/`, `src/routes.ts`, `src/shared/`, `src/config/` đã được **dọn dẹp triệt để**, giúp dự án tinh gọn, không bị nhầm lẫn giữa code cũ và code mới.

```
Cấu trúc chuẩn NestJS hiện tại (src/modules/):
src/modules/camera/
├── camera.module.ts       # Kỹ thuật: Khai báo IoC, nạp Schema, export Service
├── camera.controller.ts   # Kỹ thuật: Nhận HTTP Request, cấu hình Swagger
├── camera.service.ts      # Nghiệp vụ (Domain logic): Kiểm tra trùng lặp, mã hóa RTSP, CRUD
├── schemas/               # Database: Mongoose Schema
└── dto/                   # Dữ liệu đầu vào: ValidationPipe tự động kiểm tra
```

---

## 3. Bản Đồ 2 "Người Gác Cổng" Ở Thư Mục `common/`

Trong thư mục `src/common/`, bạn thấy 2 file:
1. `interceptors/transform.interceptor.ts`
2. `filters/http-exception.filter.ts`

Hai file này trông có vẻ phức tạp vì dùng Generics (`<T>`) và thư viện `rxjs` (`pipe`, `map`), nhưng **bản chất cực kỳ đơn giản: Chúng là 2 NGƯỜI GÁC CỔNG Ở CỬA RA CỦA SERVER.**

```
                           Client gửi Request
                                   │
                                   ▼
                         [Controller & Service]
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
         KHI THÀNH CÔNG                       KHI BỊ LỖI / CRASH
  ┌─────────────────────────────┐     ┌─────────────────────────────┐
  │    TransformInterceptor     │     │     AllExceptionsFilter     │
  │  (Cửa ra cho luồng thành    │     │  (Cửa cứu hộ khi xảy ra     │
  │   công: Tự động đóng gói    │     │   bất kỳ lỗi nào trong hệ   │
  │   dữ liệu vào hộp JSON đẹp) │     │   thống: In log đỏ & báo)   │
  └──────────────┬──────────────┘     └──────────────┬──────────────┘
                 │                                   │
                 └─────────────────┬─────────────────┘
                                   ▼
                      Client nhận phản hồi chuẩn JSON
```

### 3.1 Chi tiết: `transform.interceptor.ts` (Người đóng gói khi Thành công)
* **Vị trí:** [src/common/interceptors/transform.interceptor.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/common/interceptors/transform.interceptor.ts)
* **Nỗi khổ thời Express:** Trong mọi Controller, bạn luôn phải nhớ gõ:
  ```typescript
  return res.status(200).json({ success: true, statusCode: 200, message: 'Thành công', data: result });
  ```
  Nếu có 50 API, bạn phải lặp lại đoạn bọc này đúng 50 lần.
* **Cách NestJS giải quyết:** Controller chỉ việc trả về dữ liệu thô:
  ```typescript
  @Get()
  findAll() {
    return this.cameraService.findAll(); // 👈 Không cần gọi bọc gì cả!
  }
  ```
* **Nhiệm vụ của `TransformInterceptor`:** 
  Nó đứng ở lối ra, chặn kết quả trả về từ Controller qua `next.handle().pipe(map(...))`, rồi tự động bọc lại thành:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Success",
    "data": [ ...kết quả của bạn... ]
  }
  ```
* **Lợi ích:** Bạn không bao giờ phải viết code định dạng response trong Controller nữa.

---

### 3.2 Chi tiết: `http-exception.filter.ts` (Đội cứu thương khi Bị lỗi)
* **Vị trí:** [src/common/filters/http-exception.filter.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/common/filters/http-exception.filter.ts)
* **Nỗi khổ thời Express:** Nếu quên `try-catch` hoặc không bọc `asyncHandler`, một hàm bị lỗi có thể **làm sập máy chủ** hoặc ném về trang HTML lỗi khiến Frontend bị vỡ.
* **Cách NestJS giải quyết:** Khi có bất kỳ lỗi nào xảy ra (hoặc khi bạn chủ động ném `throw new NotFoundException('Camera không tồn tại')`):
  1. `AllExceptionsFilter` lập tức tóm lấy lỗi đó.
  2. **In log đỏ tập trung ra màn hình máy chủ:**
     ```text
     🚨 [LOG CENTER] [POST] /api/v1/cameras | Status: 400 | Message: Validation failed
     ```
  3. **Trả về Client định dạng JSON chuẩn lịch sự:**
     ```json
     {
       "success": false,
       "statusCode": 404,
       "message": "Camera không tồn tại",
       "timestamp": "2026-09-07T12:45:00.000Z",
       "path": "/api/v1/cameras/123"
     }
     ```

> 💡 **Quy tắc vàng:** Cả hai file trên **chỉ cần viết một lần duy nhất** và đã được bật sẵn toàn cục trong `main.ts`. Khi lập trình tính năng mới, bạn hoàn toàn không cần chỉnh sửa 2 file này!

---

## 4. Các Khái Niệm Cốt Lõi Khác Cần Nắm Trong NestJS

### 4.1 Decorator (Ký hiệu `@`)
* **Khái niệm:** Là một "nhãn dán chú thích" đặt ngay trên đầu class, hàm hoặc biến.
* **Ví dụ:**
  * `@Controller('api/v1/cameras')`: Đánh dấu class nhận HTTP Request.
  * `@Get(':id')`: Xử lý HTTP `GET /api/v1/cameras/:id`.
  * `@Prop()`: Đánh dấu một trường trong Database MongoDB.

### 4.2 Dependency Injection (DI) & Provider (`@Injectable`)
* **Trong Express:** Muốn dùng Service, phải tự `new CameraService()`.
* **Trong NestJS:** Đánh dấu Service với `@Injectable()`, sau đó khai báo trong `constructor` của Controller:
  ```typescript
  @Controller('cameras')
  export class CameraController {
    constructor(private readonly cameraService: CameraService) {} // 👈 NestJS tự động tiêm vào
  }
  ```
* **Lợi ích:** Không cần quản lý vòng đời hay viết `new Class()`. NestJS tự tạo Singleton và tự giải phóng bộ nhớ.

### 4.3 DTO (Data Transfer Object) & `ValidationPipe`
* **DTO là gì?** Là một `class` định nghĩa hình dáng dữ liệu mà Client **bắt buộc phải gửi lên** cho API.
* Dùng `class-validator` gắn nhãn trực tiếp:
  ```typescript
  export class CreateCameraDto {
    @IsString()
    @IsNotEmpty({ message: 'camera_code must not be empty' })
    camera_code: string;

    @IsUrl()
    url_rtsp: string;

    @IsNumber()
    fps?: number = 30;
  }
  ```
* Nếu Client gửi sai $\rightarrow$ `ValidationPipe` chặn ngay tại cửa và trả lỗi `400 Bad Request` mà bạn **không cần viết 1 dòng `if-else` nào**!

---

## 5. Bảng Đối Chiếu: Dọn Dẹp File Cũ Sang NestJS

Toàn bộ các file Express cũ đã được loại bỏ và thay thế tương ứng:

| Mã nguồn cũ đã dọn dẹp | Đã được thay thế bởi trong NestJS | Lý do & Thay đổi |
| :--- | :--- | :--- |
| `src/main.ts` (Express) | [src/main.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/main.ts) | Dùng `NestFactory.create`, bật Swagger tại `/api/docs`, bật Pipe và Filter toàn cục. |
| `src/routes.ts` | [src/app.controller.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/app.controller.ts) | Endpoint `/api/v1/healthy` được chuyển thành NestJS Controller có Swagger. |
| `src/config.ts` | `@nestjs/config` trong [app.module.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/app.module.ts) | Dùng `ConfigModule` và `ConfigService` chuẩn của NestJS. |
| `src/config/database.ts` | `MongooseModule` trong [app.module.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/app.module.ts) | NestJS tự quản lý connection pool và vòng đời kết nối MongoDB. |
| `src/shared/middlewares/error.middleware.ts` | [src/common/filters/http-exception.filter.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/common/filters/http-exception.filter.ts) | Chuyển thành `AllExceptionsFilter`. |
| `src/shared/utils/api-response.ts` | [src/common/interceptors/transform.interceptor.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/common/interceptors/transform.interceptor.ts) | Tự động hóa qua `TransformInterceptor`. |
| `src/shared/utils/app-error.ts` | Exception có sẵn của `@nestjs/common` | Dùng trực tiếp: `NotFoundException`, `ConflictException`, `BadRequestException`. |
| `src/shared/utils/async-handler.ts` | **Đã xóa bỏ** | NestJS tự động bắt Promise, không bao giờ cần bọc `asyncHandler`. |
| `src/domains/camera/*` | [src/modules/camera/*](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/modules/camera/) | Viết lại hoàn chỉnh theo chuẩn Feature Module. |
| `src/domains/auth, zone, ...` | `src/modules/<feature>` trong tương lai | Xóa bỏ các thư mục rỗng cũ. |

---

## 6. Cấu Trúc Dự Án Tinh Gọn Hiện Tại

Sau khi dọn dẹp, cây thư mục `src/` hiện tại gồm:

```text
MODULE_BE/src/
├── app.controller.ts      # Health check endpoint (/api/v1/healthy)
├── app.module.ts          # Root Module nạp Config, Mongoose, CameraModule
├── main.ts                # Khởi động server, bật Swagger, Pipe, Interceptor, Filter
├── common/                # Xử lý dùng chung toàn hệ thống
│   ├── filters/           # http-exception.filter.ts (Bắt lỗi, ghi log đỏ tập trung)
│   └── interceptors/      # transform.interceptor.ts (Chuẩn hóa response JSON)
├── modules/               # Nơi chứa toàn bộ tính năng nghiệp vụ
│   └── camera/            # Module Camera hoàn chỉnh
│       ├── camera.module.ts
│       ├── camera.controller.ts
│       ├── camera.service.ts
│       ├── schemas/camera.schema.ts
│       └── dto/
└── seeds/                 # Dữ liệu mẫu (nếu cần)
```

---

## 7. Hướng Dẫn Tự Thêm Một Tính Năng Mới (Ví dụ: `zone`)

Khi bạn muốn thêm một tính năng mới (ví dụ: `zone` - Quản lý vùng phát hiện), chỉ cần làm theo 5 bước:

### Bước 1: Tạo thư mục
Tạo thư mục `src/modules/zone/` kèm 2 thư mục con `schemas/` và `dto/`.

### Bước 2: Tạo Schema (`schemas/zone.schema.ts`)
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ZoneDocument = Zone & Document;

@Schema({ timestamps: true, collection: 'zones' })
export class Zone {
  @Prop({ required: true, trim: true })
  zone_name: string;

  @Prop({ required: true })
  camera_id: string;

  @Prop({ type: Array, required: true })
  polygon_points: number[][];
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);
```

### Bước 3: Tạo DTO (`dto/create-zone.dto.ts`)
```typescript
import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateZoneDto {
  @ApiProperty({ example: 'Khu vực quầy thu ngân' })
  @IsString()
  @IsNotEmpty()
  zone_name: string;

  @ApiProperty({ example: '6a9d8500b18c647a8e7891bd' })
  @IsString()
  @IsNotEmpty()
  camera_id: string;

  @ApiProperty({ example: [[100, 100], [200, 100], [200, 200], [100, 200]] })
  @IsArray()
  polygon_points: number[][];
}
```

### Bước 4: Tạo Service & Controller
* `zone.service.ts`: Viết logic CRUD với `@InjectModel(Zone.name)`.
* `zone.controller.ts`: Viết các endpoint với `@ApiTags('Zones')` và `@Post()`, `@Get()`.

### Bước 5: Đóng gói vào `zone.module.ts` và nạp vào `app.module.ts`
* Trong `zone.module.ts`:
  ```typescript
  @Module({
    imports: [MongooseModule.forFeature([{ name: Zone.name, schema: ZoneSchema }])],
    controllers: [ZoneController],
    providers: [ZoneService],
  })
  export class ZoneModule {}
  ```
* Mở [src/app.module.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/src/app.module.ts), thêm `ZoneModule` vào mảng `imports: [...]`.

👉 **Xong!** Ngay lập tức Swagger tại `http://localhost:3000/api/docs` sẽ tự động hiển thị mục **Zones** với đầy đủ các nút test API.

---

## 8. Các Lệnh Thao Tác Thường Dùng

```powershell
# Di chuyển vào thư mục backend
cd d:\Project_NCKH\spacelensproject\MODULE_BE

# Chạy server ở chế độ tự reload khi sửa code (Development)
npm run start:dev

# Biên dịch kiểm tra lỗi TypeScript (Build)
npm run build

# Chạy server từ bản đã build (Production)
npm run start:prod
```

* **Swagger API Docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
* **Kiểm tra sức khỏe Server:** [http://localhost:3000/api/v1/healthy](http://localhost:3000/api/v1/healthy)
* **Endpoint Camera:** `http://localhost:3000/api/v1/cameras`
