const { GoogleGenAI } = require("@google/genai");
const jwt = require("jsonwebtoken");
const Product = require("../models/product.model");
const AiChatHistory = require("../models/aiChatHistory.model");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = "gemini-3.1-flash-lite";
const MAX_PRODUCTS = 50;
const DESCRIPTION_LIMIT = 280;
const HISTORY_LIMIT = 30;

const DEFAULT_FALLBACK = "Hiện tôi chưa có thông tin đó trong hệ thống.";

const normalizeText = (value) => String(value || "").toLowerCase();

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractKeywords = (message) => {
  const cleaned = normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const tokens = cleaned
    .split(" ")
    .filter((token) => token.length > 2)
    .slice(0, 8);

  return [...new Set(tokens)];
};

const extractBudgetVnd = (message) => {
  const text = normalizeText(message);
  const match = text.match(
    /(\d+(?:[.,]\d+)?)(?:\s*)(triệu|tr|million|m|nghìn|nghin|k)?/i,
  );
  if (!match) return null;

  const value = Number(String(match[1]).replace(/,/g, "."));
  if (Number.isNaN(value)) return null;

  const unit = match[2] || "";
  if (/(triệu|tr|million|m)/i.test(unit)) return Math.round(value * 1_000_000);
  if (/(nghìn|nghin|k)/i.test(unit)) return Math.round(value * 1_000);

  return Math.round(value);
};

const detectIntent = (message) => {
  const text = normalizeText(message);
  return {
    wantsBestSeller: /(b[aá]n\s*ch[aạ]y|best\s*seller)/i.test(text),
    wantsRating: /(đ[aá]nh\s*gi[aá]|rating|review)/i.test(text),
    wantsCompare: /(so\s*s[aá]nh|compare|so\s*san[hf])/i.test(text),
    wantsBudget: /(d[uư][oớ]i|t[oố]i\s*đa|ng[aâ]n\s*s[aá]ch)/i.test(text),
  };
};

const buildPrompt = (context, message) => `
Bạn là AI tư vấn sản phẩm cho website e-commerce nội thất và ergonomics.

Mục tiêu:
- Tư vấn sản phẩm phù hợp nhu cầu người dùng
- So sánh sản phẩm khi người dùng yêu cầu
- Đề xuất sản phẩm theo ngân sách
- Trả lời dựa CHÍNH XÁC trên dữ liệu được cung cấp
- Không tự bịa thông tin ngoài dữ liệu

Quy tắc bắt buộc:
- Chỉ sử dụng dữ liệu trong danh sách bên dưới.
- Nếu thông tin không tồn tại trong dữ liệu, trả lời đúng câu sau:
  "Hiện tôi chưa có thông tin đó trong hệ thống."
- Không suy đoán thông số kỹ thuật, chất liệu, hoặc công dụng nếu không có trong dữ liệu.

Dữ liệu sản phẩm (JSON):
${context}

Câu hỏi của khách:
${message}
`;

const buildContext = (products) => {
  const payload = products.map((product) => {
    const categoryName = product?.category_id?.name || "";
    const description = String(product?.description || "").slice(
      0,
      DESCRIPTION_LIMIT,
    );
    const image =
      Array.isArray(product?.images) && product.images.length > 0
        ? product.images[0]
        : product?.image_url || "";

    return {
      id: String(product._id || ""),
      name: product?.name || "",
      price: Number(product?.price || 0),
      stock_quantity: Number(product?.stock_quantity || 0),
      rating_average: Number(product?.rating_average || 0),
      sold: Number(product?.sold || 0),
      category: categoryName,
      description,
      image,
    };
  });

  return JSON.stringify(payload);
};

const getAiText = async (result) => {
  if (!result) return "";
  if (typeof result.text === "string") return result.text;
  if (typeof result.text === "function") return result.text();
  if (result.response && typeof result.response.text === "function") {
    return result.response.text();
  }
  if (result.response && typeof result.response.text === "string") {
    return result.response.text;
  }
  return "";
};

const getUserIdFromRequest = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  const secrets = [
    process.env.JWT_SECRET,
    "secretkey",
    "TLDQ_SECRET_KEY",
  ].filter(Boolean);

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret);
      return decoded?.userId || decoded?.id || decoded?._id || null;
    } catch (error) {
      // try next secret
    }
  }

  return null;
};

exports.aiChat = async (req, res) => {
  try {
    const { message, productIds } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "message là bắt buộc" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ message: "Thiếu GEMINI_API_KEY trong env" });
    }

    const intent = detectIntent(message);
    const budget = intent.wantsBudget ? extractBudgetVnd(message) : null;
    const keywords = extractKeywords(message);

    const query = { status: "approved" };
    if (Array.isArray(productIds) && productIds.length > 0) {
      query._id = { $in: productIds };
    } else if (keywords.length > 0) {
      query.$or = keywords.flatMap((keyword) => [
        { name: { $regex: escapeRegExp(keyword), $options: "i" } },
        { description: { $regex: escapeRegExp(keyword), $options: "i" } },
      ]);
    }

    let cursor = Product.find(query).populate("category_id", "name");

    if (intent.wantsBestSeller) {
      cursor = cursor.sort({ sold: -1 });
    } else if (intent.wantsRating) {
      cursor = cursor.sort({ rating_average: -1 });
    } else {
      cursor = cursor.sort({ createdAt: -1 });
    }

    let products = await cursor.limit(MAX_PRODUCTS);

    if ((!products || products.length === 0) && !query._id) {
      products = await Product.find({ status: "approved" })
        .sort({ sold: -1 })
        .limit(20)
        .populate("category_id", "name");
    }

    if (budget) {
      products = products.filter(
        (product) => Number(product?.price || 0) <= budget,
      );
    }

    if (!products || products.length === 0) {
      return res.status(200).json({
        message: "AI trả lời thành công",
        data: { reply: DEFAULT_FALLBACK, products: [] },
      });
    }

    const context = buildContext(products);
    const prompt = buildPrompt(context, message);

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const replyRaw = await getAiText(result);
    const reply = String(replyRaw || "").trim() || DEFAULT_FALLBACK;
    const responseProducts = products.map((product) => ({
      id: String(product._id || ""),
      name: product?.name || "",
      price: Number(product?.price || 0),
      rating_average: Number(product?.rating_average || 0),
      sold: Number(product?.sold || 0),
      category: product?.category_id?.name || "",
      image:
        Array.isArray(product?.images) && product.images.length > 0
          ? product.images[0]
          : product?.image_url || "",
    }));

    const userId = getUserIdFromRequest(req);
    if (userId) {
      try {
        await AiChatHistory.create({
          user_id: String(userId),
          question: message,
          answer: reply,
          products: responseProducts.map((item) => ({
            product_id: item.id,
            name: item.name,
            price: item.price,
            rating_average: item.rating_average,
            sold: item.sold,
            category: item.category,
            image: item.image,
          })),
        });
      } catch (error) {
        console.warn("[AI Chat] Save history failed:", error.message);
      }
    }

    return res.status(200).json({
      message: "AI trả lời thành công",
      data: {
        reply,
        products: responseProducts,
      },
    });
  } catch (error) {
    console.error("[AI Chat] Error:", error.message);
    return res
      .status(500)
      .json({ message: "AI trả lời thất bại", error: error.message });
  }
};

exports.aiHistory = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const histories = await AiChatHistory.find({ user_id: String(userId) })
      .sort({ createdAt: 1 })
      .limit(HISTORY_LIMIT)
      .lean();

    const productIds = histories.flatMap((history) =>
      Array.isArray(history.products)
        ? history.products
            .map((item) => String(item.product_id || ""))
            .filter(Boolean)
        : [],
    );

    const uniqueIds = [...new Set(productIds)];
    const productMap = new Map();

    if (uniqueIds.length > 0) {
      const products = await Product.find({ _id: { $in: uniqueIds } })
        .select("images")
        .lean();

      products.forEach((product) => {
        const image =
          Array.isArray(product.images) && product.images.length > 0
            ? product.images[0]
            : "";
        productMap.set(String(product._id), image);
      });
    }

    const hydrated = histories.map((history) => ({
      ...history,
      products: Array.isArray(history.products)
        ? history.products.map((item) => ({
            ...item,
            image: item.image || productMap.get(String(item.product_id)) || "",
          }))
        : [],
    }));

    return res.status(200).json({
      message: "Lấy lịch sử AI thành công",
      data: hydrated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
