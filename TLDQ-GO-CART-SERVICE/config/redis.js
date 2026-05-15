const Redis = require("ioredis");

const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
});

client.on("connect", () => console.log("[CartService] Redis connected"));
client.on("error", (err) => console.error("[CartService] Redis error:", err.message));

const CART_TTL = 7 * 24 * 3600; // 7 ngày

function cartKey(userId) {
  return `cart:${userId}`;
}

async function getCart(userId) {
  const raw = await client.get(cartKey(userId));
  if (!raw) return { userId, items: [] };
  return JSON.parse(raw);
}

async function saveCart(userId, cart) {
  await client.set(cartKey(userId), JSON.stringify(cart), "EX", CART_TTL);
}

async function deleteCart(userId) {
  await client.del(cartKey(userId));
}

module.exports = { client, getCart, saveCart, deleteCart };
