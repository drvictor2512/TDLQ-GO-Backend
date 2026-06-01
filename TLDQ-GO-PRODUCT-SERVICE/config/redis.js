const Redis = require("ioredis");

let client = null;

function getRedis() {
  if (client) return client;

  client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    retryStrategy: (times) => {
      // Thử lại tối đa 3 lần, mỗi lần cách nhau 500ms
      if (times > 3) return null;
      return 500;
    },
  });

  client.on("connect", () => console.log("[Redis] Connected"));
  client.on("error", (err) => console.warn("[Redis] Error:", err.message));

  return client;
}

// Wrapper an toàn: nếu Redis lỗi thì cache miss — không ảnh hưởng service
async function cacheGet(key) {
  try {
    const val = await getRedis().get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // silent — cache failure không block business logic
  }
}

async function cacheDel(...keys) {
  try {
    if (keys.length > 0) await getRedis().del(...keys);
  } catch {
    // silent
  }
}

// Xóa tất cả key khớp pattern dùng SCAN cursor (an toàn cho production)
async function cacheDelPattern(pattern) {
  try {
    const redis = getRedis();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // silent
  }
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern };
