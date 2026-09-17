# TLDQ-GO Backend

Backend cho nền tảng thương mại điện tử TLDQ-GO, được xây dựng theo kiến trúc microservices với Node.js, Express và MongoDB. API Gateway là điểm truy cập duy nhất từ frontend; Nginx, Redis và RabbitMQ đảm nhiệm lần lượt việc reverse proxy, cache/giỏ hàng và giao tiếp bất đồng bộ giữa các service.

## Mục lục

- [Kiến trúc](#kiến-trúc)
- [Các service](#các-service)
- [Yêu cầu](#yêu-cầu)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy toàn bộ hệ thống bằng Docker](#chạy-toàn-bộ-hệ-thống-bằng-docker)
- [Chạy từng service ở local](#chạy-từng-service-ở-local)
- [API và kiểm tra nhanh](#api-và-kiểm-tra-nhanh)
- [Luồng dữ liệu](#luồng-dữ-liệu)
- [Vận hành và xử lý sự cố](#vận-hành-và-xử-lý-sự-cố)

## Kiến trúc

```mermaid
flowchart LR
    Client[Web client] --> Nginx[Nginx :80]
    Nginx --> Gateway[API Gateway :3000]
    Gateway --> User[User Service :3001]
    Gateway --> Product[Product Service :3002]
    Gateway --> Order[Order Service :3003]
    Gateway --> Cart[Cart Service :3004]
    User --> MongoUser[(MongoDB)]
    Product --> MongoProduct[(MongoDB)]
    Order --> MongoOrder[(MongoDB)]
    Product --> Redis[(Redis)]
    Cart --> Redis
    Product <--> Rabbit[RabbitMQ]
    Order <--> Rabbit
```

Ở môi trường Docker Compose, frontend gọi qua `http://localhost` (Nginx). Khi phát triển frontend bằng Vite, có thể gọi trực tiếp API Gateway tại `http://localhost:3000`.

## Các service

| Thành phần | Cổng mặc định | Trách nhiệm |
| --- | ---: | --- |
| `nginx` | `80` | Reverse proxy, giới hạn upload 20 MB và hỗ trợ WebSocket |
| `api-gateway` | `3000` | Định tuyến API, CORS, rate limit, Swagger, circuit breaker và Socket.IO |
| `user-service` | `3001` | Đăng ký, đăng nhập, JWT, hồ sơ và email xác thực |
| `product-service` | `3002` | Sản phẩm, danh mục, đánh giá, voucher, flash sale và AI |
| `order-service` | `3003` | Đơn hàng, thanh toán VNPay và thông báo |
| `cart-service` | `3004` | Giỏ hàng lưu trên Redis |
| `redis` | `6379` | Cache và dữ liệu giỏ hàng |
| `rabbitmq` | `5672` / `15672` | Message broker và trang quản trị |

## Yêu cầu

- Docker Desktop với Docker Compose v2
- Hoặc Node.js 18+ và npm nếu chạy từng service
- MongoDB cho `user-service`, `product-service` và `order-service`
- Tài khoản Cloudinary nếu có upload ảnh
- Tài khoản SMTP nếu sử dụng email xác thực hoặc đặt lại mật khẩu
- Tài khoản VNPay Sandbox và Gemini nếu sử dụng các tính năng tương ứng

## Cấu hình môi trường

Mỗi service đọc biến môi trường từ file `.env` riêng trong thư mục service. Không commit các file `.env` chứa secret.

### API Gateway

```env
PORT=3000
USER_SERVICE=http://user:3001
PRODUCT_SERVICE=http://product:3002
ORDER_SERVICE=http://order:3003
CART_SERVICE=http://cart:3004
```

Khi chạy ngoài Docker, thay hostname Docker bằng `localhost` tương ứng.

### User Service

```env
USER_SERVICE_PORT=3001
MONGO_URI=mongodb://localhost:27017
USER_DB_NAME=tldq_user
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
CLOUD_NAME=your-cloudinary-name
CLOUD_API_KEY=your-cloudinary-key
CLOUD_API_SECRET=your-cloudinary-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
FRONTEND_URL=http://localhost:5173
```

`USER_SERVICE_MONGO_URI`, `USER_SERVICE_DB_NAME`, `DB_NAME` cũng được hỗ trợ bởi code hiện tại như các tên thay thế cho MongoDB của user service.

### Product Service

```env
PRODUCT_SERVICE_PORT=3002
PRODUCT_SERVICE_MONGO_URI=mongodb://localhost:27017
PRODUCT_DB_NAME=tldq_product
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JWT_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key
CLOUD_NAME=your-cloudinary-name
CLOUD_API_KEY=your-cloudinary-key
CLOUD_API_SECRET=your-cloudinary-secret
```

### Order Service

```env
ORDER_SERVICE_PORT=3003
ORDER_SERVICE_MONGO_URI=mongodb://localhost:27017
ORDER_DB_NAME=tldq_order
RABBITMQ_URL=amqp://guest:guest@localhost:5672
USER_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3002
GATEWAY_URL=http://localhost:3000
VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=your-vnpay-hash-secret
VNPAY_RETURN_URL=http://localhost:5173/thanh-toan/ket-qua
```

### Cart Service

```env
CART_SERVICE_PORT=3004
REDIS_URL=redis://localhost:6379
PRODUCT_SERVICE_URL=http://localhost:3002
```

## Chạy toàn bộ hệ thống bằng Docker

1. Tạo các file `.env` theo từng service như phần [Cấu hình môi trường](#cấu-hình-môi-trường).
2. Từ thư mục `TDLQ-GO-Backend`, build và khởi động các container:

```bash
docker compose up -d --build
```

3. Kiểm tra trạng thái:

```bash
docker compose ps
docker compose logs -f api-gateway
```

4. Các địa chỉ hữu ích:

| Địa chỉ | Mục đích |
| --- | --- |
| `http://localhost` | API qua Nginx |
| `http://localhost:3000` | API Gateway trực tiếp |
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost/nginx-health` | Health check Nginx |
| `http://localhost:15672` | RabbitMQ Management UI (`guest` / `guest`) |

Dừng hệ thống bằng:

```bash
docker compose down
```

Muốn xóa cả volume dữ liệu được Docker quản lý, dùng `docker compose down -v` với sự thận trọng phù hợp.

## Chạy từng service ở local

Khởi động Redis, RabbitMQ và MongoDB trước, sau đó cài dependency và chạy từng service:

```bash
cd TLDQ-GO-USER-SERVICE
npm install
npm run dev
```

Các service còn lại có cùng quy trình:

```bash
cd TLDQ-GO-PRODUCT-SERVICE
npm install
npm run dev

cd ../TLDQ-GO-ORDER-SERVICE
npm install
npm run dev

cd ../TLDQ-GO-CART-SERVICE
npm install
npm run dev

cd ../TLDQ-GO-API-GATEWAY
npm install
npm start
```

Trong terminal local, API Gateway cần trỏ tới các service bằng `http://localhost:<port>`. Frontend Vite mặc định sử dụng `VITE_API_URL=http://localhost:3000`.

## API và kiểm tra nhanh

Tất cả endpoint nghiệp vụ đi qua API Gateway:

- `/api/users` - xác thực và người dùng
- `/api/products` - sản phẩm và danh mục
- `/api/orders` - đơn hàng và thanh toán
- `/api/cart` - giỏ hàng
- `/api/vouchers` - voucher

Kiểm tra API Gateway:

```bash
curl http://localhost:3000/
```

Kết quả mong đợi có dạng:

```json
{"status":"ok","service":"api-gateway"}
```

Swagger UI cung cấp schema và danh sách endpoint tại `http://localhost:3000/api-docs`. Có thể import collection Postman tại `docs/postman_collection.json`; collection mặc định dùng `http://localhost:3000` và tự lưu token sau khi đăng nhập.

Các service nghiệp vụ có health endpoint:

```text
GET /health
```

## Luồng dữ liệu

- Request từ frontend đi qua Nginx rồi đến API Gateway.
- API Gateway chuyển tiếp request đến service tương ứng và gắn `X-Request-ID` để trace.
- Circuit breaker tại Gateway trả về `503` khi service downstream không khả dụng.
- Product và Order trao đổi sự kiện qua RabbitMQ.
- Cart và một phần cache product sử dụng Redis.
- User, Product và Order dùng các database MongoDB riêng để tách dữ liệu.

## Vận hành và xử lý sự cố

- Xem log toàn bộ hệ thống: `docker compose logs -f`.
- Xem log một service: `docker compose logs -f product`.
- Nếu Gateway trả `Service not configured`, kiểm tra các biến `USER_SERVICE`, `PRODUCT_SERVICE`, `ORDER_SERVICE`, `CART_SERVICE`.
- Nếu service không healthy, kiểm tra MongoDB, Redis hoặc RabbitMQ trước khi restart container.
- Không dùng `guest/guest` của RabbitMQ trong môi trường production.
- Thay `JWT_SECRET`, VNPay secret, SMTP password, Cloudinary secret và Gemini key bằng secret được quản lý riêng khi triển khai thật.

## Cấu trúc thư mục

```text
TDLQ-GO-Backend/
├── docker-compose.yml
├── nginx.conf
├── docs/postman_collection.json
├── TLDQ-GO-API-GATEWAY/
├── TLDQ-GO-USER-SERVICE/
├── TLDQ-GO-PRODUCT-SERVICE/
├── TLDQ-GO-ORDER-SERVICE/
└── TLDQ-GO-CART-SERVICE/
```
