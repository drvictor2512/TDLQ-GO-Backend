/** OpenAPI 3.0 specification — TLDQ-GO E-Commerce API */
const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "TLDQ-GO E-Commerce API",
    version: "1.0.0",
    description:
      "API documentation for TLDQ-GO — hệ thống thương mại điện tử Bàn Ghế Công Thái Học. " +
      "Tất cả requests đi qua **API Gateway** (port 3000), được proxy đến các microservices tương ứng.",
    contact: { name: "TLDQ-GO Team" },
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development" },
    { url: "http://api.tldq-go.com", description: "Production" },
  ],
  tags: [
    { name: "Auth",           description: "Đăng ký / Đăng nhập / Token" },
    { name: "User Profile",   description: "Thông tin tài khoản & cài đặt" },
    { name: "Seller",         description: "Tài khoản & cài đặt cửa hàng" },
    { name: "Admin — Users",  description: "Quản lý người dùng (Admin only)" },
    { name: "Products",       description: "Danh sách & chi tiết sản phẩm" },
    { name: "Admin — Products", description: "Duyệt / từ chối sản phẩm (Admin only)" },
    { name: "Categories",     description: "Danh mục sản phẩm" },
    { name: "Reviews",        description: "Đánh giá sản phẩm" },
    { name: "Flash Sales",    description: "Flash sale theo thời gian" },
    { name: "Vouchers",       description: "Mã giảm giá" },
    { name: "Cart",           description: "Giỏ hàng (Redis)" },
    { name: "Orders",         description: "Đặt hàng & quản lý đơn" },
    { name: "Payments",       description: "Thanh toán VNPay" },
    { name: "Statistics",     description: "Thống kê doanh thu" },
    { name: "Notifications",  description: "Thông báo real-time" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token. Lấy từ response của login endpoint.",
      },
    },
    schemas: {
      // ── Common ────────────────────────────────────────────────────────────
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Lỗi xử lý yêu cầu" },
        },
      },
      SuccessMessage: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Thành công" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page:       { type: "integer", example: 1 },
          totalPages: { type: "integer", example: 5 },
          totalItems: { type: "integer", example: 48 },
          limit:      { type: "integer", example: 10 },
        },
      },
      // ── User ──────────────────────────────────────────────────────────────
      User: {
        type: "object",
        properties: {
          _id:       { type: "string", example: "64a1b2c3d4e5f6a7b8c9d0e1" },
          full_name: { type: "string", example: "Nguyễn Văn A" },
          email:     { type: "string", example: "user@example.com" },
          role:      { type: "string", enum: ["customer", "seller", "admin"] },
          phone:     { type: "string", example: "0901234567" },
          avatar:    { type: "string", example: "https://cloudinary.com/..." },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TokenResponse: {
        type: "object",
        properties: {
          success:      { type: "boolean", example: true },
          token:        { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          user:         { $ref: "#/components/schemas/User" },
        },
      },
      // ── Product ───────────────────────────────────────────────────────────
      Product: {
        type: "object",
        properties: {
          _id:           { type: "string" },
          name:          { type: "string", example: "Ghế gaming XG-500" },
          price:         { type: "number", example: 3500000 },
          stock_quantity:{ type: "integer", example: 50 },
          description:   { type: "string" },
          images:        { type: "array", items: { type: "string" } },
          category_id:   { $ref: "#/components/schemas/Category" },
          seller_id:     { type: "string" },
          status:        { type: "string", enum: ["pending", "approved", "rejected"] },
          rating_average:{ type: "number", example: 4.5 },
          rating_count:  { type: "integer", example: 23 },
          createdAt:     { type: "string", format: "date-time" },
        },
      },
      Category: {
        type: "object",
        properties: {
          _id:  { type: "string" },
          name: { type: "string", example: "Ghế công thái học" },
          slug: { type: "string", example: "ghe-cong-thai-hoc" },
        },
      },
      Review: {
        type: "object",
        properties: {
          _id:        { type: "string" },
          product_id: { type: "string" },
          user_id:    { type: "string" },
          rating:     { type: "integer", minimum: 1, maximum: 5, example: 5 },
          comment:    { type: "string", example: "Sản phẩm rất tốt!" },
          createdAt:  { type: "string", format: "date-time" },
        },
      },
      FlashSale: {
        type: "object",
        properties: {
          _id:              { type: "string" },
          product_id:       { type: "string" },
          seller_id:        { type: "string" },
          sale_price:       { type: "number", example: 2800000 },
          original_price:   { type: "number", example: 3500000 },
          discount_percent: { type: "integer", example: 20 },
          start_time:       { type: "string", format: "date-time" },
          end_time:         { type: "string", format: "date-time" },
          quantity_limit:   { type: "integer", example: 50 },
          status:           { type: "string", enum: ["upcoming", "active", "ended"] },
        },
      },
      Voucher: {
        type: "object",
        properties: {
          _id:          { type: "string" },
          code:         { type: "string", example: "SALE20" },
          discount_type:{ type: "string", enum: ["percent", "fixed"] },
          discount_value:{ type: "number", example: 20 },
          min_order:    { type: "number", example: 500000 },
          max_discount: { type: "number", example: 100000 },
          expires_at:   { type: "string", format: "date-time" },
          seller_id:    { type: "string" },
        },
      },
      // ── Cart ──────────────────────────────────────────────────────────────
      CartItem: {
        type: "object",
        properties: {
          product_id:   { type: "string" },
          product_name: { type: "string" },
          price:        { type: "number" },
          quantity:     { type: "integer" },
          image:        { type: "string" },
          seller_id:    { type: "string" },
        },
      },
      Cart: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          items:   { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          total:   { type: "number", example: 7000000 },
        },
      },
      // ── Order ─────────────────────────────────────────────────────────────
      OrderItem: {
        type: "object",
        properties: {
          product_id:   { type: "string" },
          product_name: { type: "string" },
          quantity:     { type: "integer" },
          price:        { type: "number" },
        },
      },
      Order: {
        type: "object",
        properties: {
          _id:              { type: "string" },
          customer_id:      { type: "string" },
          seller_id:        { type: "string" },
          receiver_name:    { type: "string", example: "Nguyễn Văn A" },
          phone_number:     { type: "string", example: "0901234567" },
          shipping_address: { type: "string", example: "123 Lê Lợi, Q1, TP.HCM" },
          payment_method:   { type: "string", enum: ["cod", "vnpay"] },
          payment_status:   { type: "string", enum: ["pending", "paid", "failed"] },
          items:            { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
          total_amount:     { type: "number", example: 3500000 },
          status:           {
            type: "string",
            enum: ["awaiting_payment", "pending", "confirmed", "preparing", "delivering", "completed", "cancelled"],
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Notification: {
        type: "object",
        properties: {
          _id:      { type: "string" },
          user_id:  { type: "string" },
          type:     { type: "string", example: "order_status" },
          title:    { type: "string", example: "Đơn hàng đã được xác nhận" },
          message:  { type: "string" },
          order_id: { type: "string" },
          is_read:  { type: "boolean" },
          createdAt:{ type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Token không hợp lệ hoặc đã hết hạn",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "Không đủ quyền truy cập",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Không tìm thấy tài nguyên",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },

  paths: {
    // ═══════════════════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════════════════
    "/api/users/user/register": {
      post: {
        tags: ["Auth"],
        summary: "Đăng ký tài khoản khách hàng",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["full_name", "email", "password"],
                properties: {
                  full_name: { type: "string", example: "Nguyễn Văn A" },
                  email:     { type: "string", example: "user@example.com" },
                  password:  { type: "string", example: "Password@123" },
                  role:      { type: "string", enum: ["customer"], default: "customer" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Đăng ký thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessage" } } } },
          400: { description: "Email đã tồn tại hoặc dữ liệu không hợp lệ" },
        },
      },
    },
    "/api/users/user/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập khách hàng",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", example: "user@example.com" },
                  password: { type: "string", example: "Password@123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đăng nhập thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          401: { description: "Sai email hoặc mật khẩu" },
        },
      },
    },
    "/api/users/seller/register": {
      post: {
        tags: ["Auth"],
        summary: "Đăng ký tài khoản seller mới",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["full_name", "email", "password"],
                properties: {
                  full_name: { type: "string", example: "Shop ABC" },
                  email:     { type: "string", example: "seller@example.com" },
                  password:  { type: "string", example: "Password@123" },
                  phone:     { type: "string", example: "0901234567" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Đăng ký seller thành công" },
          400: { description: "Email đã tồn tại" },
        },
      },
    },
    "/api/users/seller/upgrade": {
      post: {
        tags: ["Auth"],
        summary: "Nâng cấp tài khoản customer → seller",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                properties: {
                  full_name: { type: "string", example: "Tên cửa hàng" },
                  phone:     { type: "string", example: "0901234567" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Nâng cấp thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/users/seller/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập seller",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", example: "seller@example.com" },
                  password: { type: "string", example: "Password@123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đăng nhập thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          401: { description: "Sai thông tin hoặc không phải seller" },
        },
      },
    },
    "/api/users/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập admin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email", "password"],
                properties: {
                  email:    { type: "string", example: "admin@tldq-go.com" },
                  password: { type: "string", example: "AdminPass@123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đăng nhập admin thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          403: { description: "Tài khoản không có quyền admin" },
        },
      },
    },
    "/api/users/refresh-token": {
      post: {
        tags: ["Auth"],
        summary: "Làm mới access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Token mới", content: { "application/json": { schema: { properties: { token: { type: "string" } } } } } },
          401: { description: "Refresh token không hợp lệ" },
        },
      },
    },
    "/api/users/logout": {
      post: {
        tags: ["Auth"],
        summary: "Đăng xuất (thu hồi refresh token)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Đăng xuất thành công" },
        },
      },
    },
    "/api/users/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Gửi email đặt lại mật khẩu",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email"],
                properties: { email: { type: "string", example: "user@example.com" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Email đã được gửi" },
          404: { description: "Email không tồn tại" },
        },
      },
    },
    "/api/users/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Đặt lại mật khẩu bằng token từ email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["token", "newPassword"],
                properties: {
                  token:       { type: "string" },
                  newPassword: { type: "string", example: "NewPassword@123" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đặt lại mật khẩu thành công" },
          400: { description: "Token hết hạn hoặc không hợp lệ" },
        },
      },
    },
    // ── User Profile ────────────────────────────────────────────────────────
    "/api/users/me": {
      get: {
        tags: ["User Profile"],
        summary: "Lấy thông tin tài khoản đang đăng nhập",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Thông tin user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/users/change-password": {
      post: {
        tags: ["User Profile"],
        summary: "Đổi mật khẩu",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword:     { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đổi mật khẩu thành công" },
          400: { description: "Mật khẩu hiện tại sai" },
        },
      },
    },
    "/api/users/user/profile": {
      put: {
        tags: ["User Profile"],
        summary: "Cập nhật thông tin khách hàng",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                properties: {
                  full_name: { type: "string" },
                  phone:     { type: "string" },
                  avatar:    { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Cập nhật thành công", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
        },
      },
    },
    // ── Seller ───────────────────────────────────────────────────────────────
    "/api/users/seller/setup-status": {
      get: {
        tags: ["Seller"],
        summary: "Kiểm tra trạng thái thiết lập cửa hàng",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Trạng thái setup",
            content: {
              "application/json": {
                schema: {
                  properties: {
                    isComplete:  { type: "boolean" },
                    missingFields: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/seller/settings": {
      put: {
        tags: ["Seller"],
        summary: "Cập nhật cài đặt cửa hàng (tên, logo, banner, địa chỉ)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                properties: {
                  shop_name:    { type: "string" },
                  shop_address: { type: "string" },
                  phone:        { type: "string" },
                  logo:         { type: "string", format: "binary" },
                  banner:       { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Cập nhật thành công" },
        },
      },
    },
    "/api/users/seller/{id}/profile": {
      get: {
        tags: ["Seller"],
        summary: "Xem profile công khai của seller",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Profile seller" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    // ── Admin — Users ────────────────────────────────────────────────────────
    "/api/users/admin/users": {
      get: {
        tags: ["Admin — Users"],
        summary: "Danh sách tất cả người dùng",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit",  in: "query", schema: { type: "integer", default: 20 } },
          { name: "role",   in: "query", schema: { type: "string", enum: ["customer", "seller", "admin"] } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Tìm theo tên/email" },
        ],
        responses: {
          200: {
            description: "Danh sách users",
            content: {
              "application/json": {
                schema: {
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/User" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Admin — Users"],
        summary: "Tạo người dùng mới (Admin)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["full_name", "email", "password", "role"],
                properties: {
                  full_name: { type: "string" },
                  email:     { type: "string" },
                  password:  { type: "string" },
                  role:      { type: "string", enum: ["customer", "seller", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Tạo thành công" },
        },
      },
    },
    "/api/users/admin/users/{id}": {
      get: {
        tags: ["Admin — Users"],
        summary: "Chi tiết người dùng",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Thông tin user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
        },
      },
      put: {
        tags: ["Admin — Users"],
        summary: "Cập nhật người dùng (block, đổi role...)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  full_name: { type: "string" },
                  role:      { type: "string" },
                  is_active: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
      delete: {
        tags: ["Admin — Users"],
        summary: "Xoá người dùng",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Xoá thành công" } },
      },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "Lấy tất cả sản phẩm (không phân trang)",
        responses: {
          200: { description: "Danh sách sản phẩm", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } } },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Tạo sản phẩm mới (Seller)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                required: ["name", "price", "stock_quantity", "seller_id", "category_id"],
                properties: {
                  name:           { type: "string", example: "Ghế gaming XG-500" },
                  price:          { type: "number", example: 3500000 },
                  stock_quantity: { type: "integer", example: 50 },
                  category_id:    { type: "string" },
                  seller_id:      { type: "string" },
                  description:    { type: "string" },
                  images:         { type: "array", items: { type: "string", format: "binary" }, maxItems: 5 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Tạo sản phẩm thành công (status: pending, chờ admin duyệt)" },
        },
      },
    },
    "/api/products/page": {
      get: {
        tags: ["Products"],
        summary: "Danh sách sản phẩm có phân trang (đã approved)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          200: {
            description: "Danh sách sản phẩm + pagination",
            content: {
              "application/json": {
                schema: {
                  properties: {
                    success:    { type: "boolean" },
                    data:       { type: "array", items: { $ref: "#/components/schemas/Product" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/products/search": {
      get: {
        tags: ["Products"],
        summary: "Tìm kiếm & lọc sản phẩm",
        parameters: [
          { name: "q",        in: "query", schema: { type: "string" },  description: "Từ khoá tìm kiếm" },
          { name: "category", in: "query", schema: { type: "string" },  description: "Tên danh mục" },
          { name: "minPrice", in: "query", schema: { type: "number" },  description: "Giá tối thiểu" },
          { name: "maxPrice", in: "query", schema: { type: "number" },  description: "Giá tối đa" },
          { name: "minRating",in: "query", schema: { type: "integer" }, description: "Rating tối thiểu (1–5)" },
          { name: "inStock",  in: "query", schema: { type: "boolean" }, description: "Chỉ lấy còn hàng" },
          { name: "sort",     in: "query", schema: { type: "string", enum: ["price_asc", "price_desc", "newest", "best_selling"] } },
          { name: "page",     in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: {
          200: { description: "Kết quả tìm kiếm + pagination" },
        },
      },
    },
    "/api/products/seller/{seller_id}": {
      get: {
        tags: ["Products"],
        summary: "Sản phẩm của một seller",
        parameters: [
          { name: "seller_id", in: "path", required: true, schema: { type: "string" } },
          { name: "page",      in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: { 200: { description: "Danh sách sản phẩm của seller" } },
      },
    },
    "/api/products/category/name/{name}": {
      get: {
        tags: ["Products"],
        summary: "Sản phẩm theo tên danh mục",
        parameters: [
          { name: "name", in: "path", required: true, schema: { type: "string" }, example: "ghe-cong-thai-hoc" },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Danh sách sản phẩm theo danh mục" } },
      },
    },
    "/api/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Chi tiết sản phẩm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Chi tiết sản phẩm", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Products"],
        summary: "Cập nhật sản phẩm (Seller)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                properties: {
                  name:           { type: "string" },
                  price:          { type: "number" },
                  stock_quantity: { type: "integer" },
                  description:    { type: "string" },
                  image:          { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Xoá sản phẩm (Seller)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Xoá thành công" } },
      },
    },
    "/api/products/{id}/stock": {
      patch: {
        tags: ["Products"],
        summary: "Cập nhật tồn kho",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: { properties: { quantity: { type: "integer", example: -1 } } },
            },
          },
        },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
    },
    "/api/products/{id}/related": {
      get: {
        tags: ["Products"],
        summary: "Sản phẩm liên quan (cùng danh mục)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Danh sách sản phẩm liên quan" } },
      },
    },
    // ── Admin — Products ────────────────────────────────────────────────────
    "/api/products/admin": {
      get: {
        tags: ["Admin — Products"],
        summary: "Danh sách tất cả sản phẩm (Admin, kể cả pending)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] } },
          { name: "page",   in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Danh sách sản phẩm" } },
      },
    },
    "/api/products/{id}/approve": {
      patch: {
        tags: ["Admin — Products"],
        summary: "Duyệt sản phẩm",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Sản phẩm đã được duyệt" } },
      },
    },
    "/api/products/{id}/reject": {
      patch: {
        tags: ["Admin — Products"],
        summary: "Từ chối sản phẩm",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { properties: { reason: { type: "string", example: "Ảnh không rõ nét" } } },
            },
          },
        },
        responses: { 200: { description: "Sản phẩm đã bị từ chối" } },
      },
    },
    // ── Categories ──────────────────────────────────────────────────────────
    "/api/products/categories": {
      get: {
        tags: ["Categories"],
        summary: "Lấy tất cả danh mục",
        responses: { 200: { description: "Danh sách danh mục", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Category" } } } } } },
      },
      post: {
        tags: ["Categories"],
        summary: "Tạo danh mục mới (Admin)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["name"],
                properties: { name: { type: "string", example: "Ghế công thái học" } },
              },
            },
          },
        },
        responses: { 201: { description: "Tạo danh mục thành công" } },
      },
    },
    "/api/products/categories/{id}": {
      get: {
        tags: ["Categories"],
        summary: "Chi tiết danh mục",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Chi tiết danh mục" } },
      },
      put: {
        tags: ["Categories"],
        summary: "Cập nhật danh mục",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { properties: { name: { type: "string" } } } } } },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
      delete: {
        tags: ["Categories"],
        summary: "Xoá danh mục",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Xoá thành công" } },
      },
    },
    // ── Reviews ─────────────────────────────────────────────────────────────
    "/api/products/{id}/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "Lấy đánh giá của sản phẩm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" }],
        responses: { 200: { description: "Danh sách reviews", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Review" } } } } } },
      },
      post: {
        tags: ["Reviews"],
        summary: "Thêm đánh giá sản phẩm",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["rating", "user_id"],
                properties: {
                  user_id: { type: "string" },
                  rating:  { type: "integer", minimum: 1, maximum: 5 },
                  comment: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Đánh giá đã được thêm" } },
      },
    },
    // ── Flash Sales ─────────────────────────────────────────────────────────
    "/api/products/flash-sales/active": {
      get: {
        tags: ["Flash Sales"],
        summary: "Danh sách flash sale đang diễn ra",
        responses: { 200: { description: "Flash sales active", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FlashSale" } } } } } },
      },
    },
    "/api/products/flash-sales": {
      post: {
        tags: ["Flash Sales"],
        summary: "Tạo flash sale mới (Seller)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["product_id", "seller_id", "sale_price", "start_time", "end_time"],
                properties: {
                  product_id:     { type: "string" },
                  seller_id:      { type: "string" },
                  sale_price:     { type: "number", example: 2800000 },
                  start_time:     { type: "string", format: "date-time" },
                  end_time:       { type: "string", format: "date-time" },
                  quantity_limit: { type: "integer", example: 50, description: "0 = không giới hạn" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Tạo flash sale thành công" },
          400: { description: "sale_price phải nhỏ hơn giá gốc" },
        },
      },
    },
    "/api/products/flash-sales/seller/{sellerId}": {
      get: {
        tags: ["Flash Sales"],
        summary: "Danh sách flash sale của seller",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "sellerId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Flash sales của seller" } },
      },
    },
    "/api/products/{id}/flash-sale": {
      get: {
        tags: ["Flash Sales"],
        summary: "Flash sale hiện tại của sản phẩm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Product ID" }],
        responses: {
          200: { description: "Flash sale đang active", content: { "application/json": { schema: { $ref: "#/components/schemas/FlashSale" } } } },
          404: { description: "Không có flash sale" },
        },
      },
    },
    "/api/products/flash-sales/{id}": {
      patch: {
        tags: ["Flash Sales"],
        summary: "Cập nhật flash sale",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: {
                  sale_price:     { type: "number" },
                  start_time:     { type: "string", format: "date-time" },
                  end_time:       { type: "string", format: "date-time" },
                  quantity_limit: { type: "integer" },
                  seller_id:      { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
      delete: {
        tags: ["Flash Sales"],
        summary: "Xoá flash sale",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { properties: { seller_id: { type: "string" } } } } },
        },
        responses: { 200: { description: "Xoá thành công" } },
      },
    },
    // ── Vouchers ────────────────────────────────────────────────────────────
    "/api/vouchers/seller/{seller_id}": {
      get: {
        tags: ["Vouchers"],
        summary: "Danh sách voucher của seller",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "seller_id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Danh sách voucher", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Voucher" } } } } } },
      },
    },
    "/api/vouchers": {
      post: {
        tags: ["Vouchers"],
        summary: "Tạo voucher mới",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["code", "discount_type", "discount_value", "seller_id"],
                properties: {
                  code:           { type: "string", example: "SALE20" },
                  discount_type:  { type: "string", enum: ["percent", "fixed"] },
                  discount_value: { type: "number", example: 20 },
                  min_order:      { type: "number", example: 500000 },
                  max_discount:   { type: "number", example: 100000 },
                  expires_at:     { type: "string", format: "date-time" },
                  seller_id:      { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Tạo voucher thành công" } },
      },
    },
    "/api/vouchers/{id}": {
      put: {
        tags: ["Vouchers"],
        summary: "Cập nhật voucher",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Voucher" } } } },
        responses: { 200: { description: "Cập nhật thành công" } },
      },
      delete: {
        tags: ["Vouchers"],
        summary: "Xoá voucher",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Xoá thành công" } },
      },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // CART
    // ═══════════════════════════════════════════════════════════════════════
    "/api/cart/{userId}": {
      get: {
        tags: ["Cart"],
        summary: "Lấy giỏ hàng của người dùng",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Giỏ hàng hiện tại", content: { "application/json": { schema: { $ref: "#/components/schemas/Cart" } } } },
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Xoá toàn bộ giỏ hàng (sau checkout)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Đã xoá giỏ hàng" } },
      },
    },
    "/api/cart/{userId}/items": {
      post: {
        tags: ["Cart"],
        summary: "Thêm sản phẩm vào giỏ hàng",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["product_id", "quantity"],
                properties: {
                  product_id:   { type: "string" },
                  product_name: { type: "string" },
                  price:        { type: "number" },
                  quantity:     { type: "integer", minimum: 1 },
                  image:        { type: "string" },
                  seller_id:    { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Đã thêm vào giỏ", content: { "application/json": { schema: { $ref: "#/components/schemas/Cart" } } } },
        },
      },
    },
    "/api/cart/{userId}/items/{productId}": {
      put: {
        tags: ["Cart"],
        summary: "Cập nhật số lượng sản phẩm trong giỏ",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "userId",    in: "path", required: true, schema: { type: "string" } },
          { name: "productId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["quantity"],
                properties: { quantity: { type: "integer", minimum: 1 } },
              },
            },
          },
        },
        responses: { 200: { description: "Đã cập nhật giỏ hàng" } },
      },
      delete: {
        tags: ["Cart"],
        summary: "Xoá sản phẩm khỏi giỏ hàng",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "userId",    in: "path", required: true, schema: { type: "string" } },
          { name: "productId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Đã xoá khỏi giỏ" } },
      },
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ORDERS
    // ═══════════════════════════════════════════════════════════════════════
    "/api/orders": {
      post: {
        tags: ["Orders"],
        summary: "Tạo đơn hàng mới",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["customer_id", "seller_id", "items", "receiver_name", "phone_number", "shipping_address", "payment_method"],
                properties: {
                  customer_id:      { type: "string" },
                  seller_id:        { type: "string" },
                  receiver_name:    { type: "string", example: "Nguyễn Văn A" },
                  phone_number:     { type: "string", example: "0901234567" },
                  shipping_address: { type: "string", example: "123 Lê Lợi, Q1, TP.HCM" },
                  payment_method:   { type: "string", enum: ["cod", "vnpay"] },
                  note:             { type: "string" },
                  voucher_code:     { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      required: ["product_id", "quantity", "price"],
                      properties: {
                        product_id:   { type: "string" },
                        product_name: { type: "string" },
                        quantity:     { type: "integer" },
                        price:        { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Đơn hàng được tạo. Nếu payment_method là vnpay, response chứa paymentUrl.", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } },
        },
      },
      get: {
        tags: ["Orders"],
        summary: "Lấy tất cả đơn hàng (Admin)",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Danh sách đơn hàng" } },
      },
    },
    "/api/orders/customer/{customer_id}": {
      get: {
        tags: ["Orders"],
        summary: "Lịch sử đơn hàng của khách hàng",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "customer_id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Danh sách đơn của khách", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Order" } } } } },
        },
      },
    },
    "/api/orders/seller/{seller_id}": {
      get: {
        tags: ["Orders"],
        summary: "Đơn hàng của seller",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "seller_id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Danh sách đơn hàng của seller" } },
      },
    },
    "/api/orders/{id}/status": {
      put: {
        tags: ["Orders"],
        summary: "Cập nhật trạng thái đơn hàng (Seller)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["confirmed", "preparing", "delivering", "completed", "cancelled"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Trạng thái đã được cập nhật" } },
      },
    },
    // ── Payments ────────────────────────────────────────────────────────────
    "/api/orders/vnpay/create-payment": {
      post: {
        tags: ["Payments"],
        summary: "Tạo URL thanh toán VNPay",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["orderId", "amount"],
                properties: {
                  orderId:  { type: "string", description: "ID đơn hàng đã tạo" },
                  amount:   { type: "number", example: 3500000 },
                  orderInfo:{ type: "string", example: "Thanh toan don hang #ABC123" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "URL redirect đến trang thanh toán VNPay",
            content: {
              "application/json": {
                schema: { properties: { paymentUrl: { type: "string", example: "https://sandbox.vnpayment.vn/paymentv2/..." } } },
              },
            },
          },
        },
      },
    },
    "/api/orders/vnpay/verify": {
      get: {
        tags: ["Payments"],
        summary: "Xác nhận kết quả thanh toán VNPay (callback)",
        description: "VNPay redirect về URL này sau khi khách hoàn tất thanh toán. " +
          "Endpoint kiểm tra chữ ký và cập nhật trạng thái đơn hàng.",
        parameters: [
          { name: "vnp_TxnRef",        in: "query", schema: { type: "string" }, description: "Mã tham chiếu giao dịch" },
          { name: "vnp_ResponseCode",  in: "query", schema: { type: "string" }, description: "'00' = thành công" },
          { name: "vnp_SecureHash",    in: "query", schema: { type: "string" }, description: "Chữ ký xác thực" },
        ],
        responses: {
          200: { description: "Thanh toán thành công / thất bại (tuỳ vnp_ResponseCode)" },
        },
      },
    },
    // ── Statistics ──────────────────────────────────────────────────────────
    "/api/orders/seller/{seller_id}/stats": {
      get: {
        tags: ["Statistics"],
        summary: "Thống kê doanh thu seller",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "seller_id", in: "path", required: true, schema: { type: "string" } },
          { name: "period",    in: "query", schema: { type: "string", enum: ["7days", "30days", "3months", "6months", "year"], default: "30days" } },
        ],
        responses: {
          200: {
            description: "Thống kê doanh thu",
            content: {
              "application/json": {
                schema: {
                  properties: {
                    summary: {
                      properties: {
                        total_revenue:      { type: "number" },
                        total_orders:       { type: "integer" },
                        completed_orders:   { type: "integer" },
                        cancelled_orders:   { type: "integer" },
                      },
                    },
                    revenue_by_date: { type: "array", items: { properties: { date: { type: "string" }, revenue: { type: "number" } } } },
                    top_products:    { type: "array", items: { properties: { product_name: { type: "string" }, total_quantity: { type: "integer" }, total_revenue: { type: "number" } } } },
                    status_distribution: { type: "array", items: { properties: { status: { type: "string" }, count: { type: "integer" } } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/orders/admin/stats": {
      get: {
        tags: ["Statistics"],
        summary: "Thống kê toàn hệ thống (Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7days", "30days", "3months", "6months", "year"], default: "30days" } },
        ],
        responses: { 200: { description: "Thống kê toàn hệ thống" } },
      },
    },
    // ── Notifications ────────────────────────────────────────────────────────
    "/api/orders/notifications/{userId}": {
      get: {
        tags: ["Notifications"],
        summary: "Lấy danh sách thông báo của user",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Danh sách thông báo",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } } } },
          },
        },
      },
    },
    "/api/orders/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Đánh dấu thông báo đã đọc",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Notification ID" }],
        responses: { 200: { description: "Đã đánh dấu đọc" } },
      },
    },
    "/api/orders/notifications/user/{userId}/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Đánh dấu tất cả thông báo đã đọc",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Tất cả thông báo đã được đánh dấu đọc" } },
      },
    },
  },
};

module.exports = swaggerSpec;
