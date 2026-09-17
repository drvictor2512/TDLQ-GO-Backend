# TLDQ-GO Backend

Backend for the TLDQ-GO e-commerce platform, built with a microservices architecture using Node.js, Express, and MongoDB. The API Gateway is the single entry point for the frontend; Nginx, Redis, and RabbitMQ provide reverse proxying, caching/cart storage, and asynchronous service communication.

## Table of contents

- [Architecture](#architecture)
- [Services](#services)
- [Requirements](#requirements)
- [Environment configuration](#environment-configuration)
- [Run the full system with Docker](#run-the-full-system-with-docker)
- [Run individual services locally](#run-individual-services-locally)
- [API and quick checks](#api-and-quick-checks)
- [Data flow](#data-flow)
- [Operations and troubleshooting](#operations-and-troubleshooting)

## Architecture

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

In the Docker Compose environment, the frontend connects through `http://localhost` (Nginx). When developing the frontend with Vite, it can connect directly to the API Gateway at `http://localhost:3000`.

## Services

| Component | Default port | Responsibility |
| --- | ---: | --- |
| `nginx` | `80` | Reverse proxy, 20 MB upload limit, and WebSocket support |
| `api-gateway` | `3000` | API routing, CORS, rate limiting, Swagger, circuit breakers, and Socket.IO |
| `user-service` | `3001` | Registration, authentication, JWT, profiles, and verification email |
| `product-service` | `3002` | Products, categories, reviews, vouchers, flash sales, and AI |
| `order-service` | `3003` | Orders, VNPay payments, and notifications |
| `cart-service` | `3004` | Redis-backed shopping cart |
| `redis` | `6379` | Cache and cart data |
| `rabbitmq` | `5672` / `15672` | Message broker and management UI |

## Requirements

- Docker Desktop with Docker Compose v2
- Node.js 18+ and npm when running services individually
- MongoDB for `user-service`, `product-service`, and `order-service`
- A Cloudinary account for image uploads
- An SMTP account for verification and password reset emails
- VNPay Sandbox and Gemini accounts for the corresponding features

## Environment configuration

Each service reads environment variables from its own `.env` file. Do not commit `.env` files containing secrets.

### API Gateway

```env
PORT=3000
USER_SERVICE=http://user:3001
PRODUCT_SERVICE=http://product:3002
ORDER_SERVICE=http://order:3003
CART_SERVICE=http://cart:3004
```

When running outside Docker, replace Docker hostnames with the corresponding `localhost` addresses.

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

The current code also supports `USER_SERVICE_MONGO_URI`, `USER_SERVICE_DB_NAME`, and `DB_NAME` as alternative variable names for the user service MongoDB configuration.

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

## Run the full system with Docker

1. Create the service-specific `.env` files described in [Environment configuration](#environment-configuration).
2. From the `TDLQ-GO-Backend` directory, build and start the containers:

```bash
docker compose up -d --build
```

3. Check the status:

```bash
docker compose ps
docker compose logs -f api-gateway
```

4. Useful URLs:

| URL | Purpose |
| --- | --- |
| `http://localhost` | API through Nginx |
| `http://localhost:3000` | Direct API Gateway access |
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost/nginx-health` | Nginx health check |
| `http://localhost:15672` | RabbitMQ Management UI (`guest` / `guest`) |

Stop the system with:

```bash
docker compose down
```

To also remove Docker-managed data volumes, use `docker compose down -v` with appropriate caution.

## Run individual services locally

Start Redis, RabbitMQ, and MongoDB first. Then install dependencies and run each service:

```bash
cd TLDQ-GO-USER-SERVICE
npm install
npm run dev
```

The remaining services follow the same process:

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

In a local terminal, the API Gateway must point to the services through `http://localhost:<port>`. The Vite frontend uses `VITE_API_URL=http://localhost:3000` by default.

## API and quick checks

All business endpoints go through the API Gateway:

- `/api/users` - authentication and users
- `/api/products` - products and categories
- `/api/orders` - orders and payments
- `/api/cart` - shopping cart
- `/api/vouchers` - vouchers

Check the API Gateway:

```bash
curl http://localhost:3000/
```

The expected response is:

```json
{"status":"ok","service":"api-gateway"}
```

Swagger UI provides the schema and endpoint list at `http://localhost:3000/api-docs`. You can import the Postman collection from `docs/postman_collection.json`; it uses `http://localhost:3000` by default and stores the token after login.

Business services expose the following health endpoint:

```text
GET /health
```

## Data flow

- Frontend requests pass through Nginx and then reach the API Gateway.
- The API Gateway forwards requests to the appropriate service and adds `X-Request-ID` for tracing.
- The Gateway circuit breakers return `503` when a downstream service is unavailable.
- Product and Order exchange events through RabbitMQ.
- Cart and part of the product cache use Redis.
- User, Product, and Order use separate MongoDB databases for data isolation.

## Operations and troubleshooting

- View all system logs: `docker compose logs -f`.
- View one service's logs: `docker compose logs -f product`.
- If the Gateway returns `Service not configured`, check `USER_SERVICE`, `PRODUCT_SERVICE`, `ORDER_SERVICE`, and `CART_SERVICE`.
- If a service is unhealthy, check MongoDB, Redis, or RabbitMQ before restarting the container.
- Do not use RabbitMQ's `guest/guest` credentials in production.
- Replace `JWT_SECRET`, VNPay secrets, SMTP passwords, Cloudinary secrets, and the Gemini key with managed secrets for real deployments.

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
