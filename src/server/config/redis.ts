import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
export let redis: unknown = null;
export let isRedisConnected = false;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });
    redis.on("connect", () => {
      isRedisConnected = true;
  // Log de desenvolvimento removido em produção pelo AutoPatch
    });
    redis.on("error", (err: unknown) => {
      isRedisConnected = false;
      console.warn("[LicitaPro Redis] Erro ou desconexão no cliente Redis (utilizando pool em memória temporariamente):", err.message);
    });
  } catch (err: unknown) {
    console.error("[LicitaPro Redis] Falha ao instanciar cliente Redis:", err.message);
  }
} else {
  console.info("[LicitaPro Redis] Variável REDIS_URL não definida. Cache e rate limit utilizando persistência volátil em memória.");
}

// In-Memory cache definition
interface CacheEntry {
  data: unknown;
  expiry: number;
}
const apiCache = new Map<string, CacheEntry>();

export async function getCachedData(key: string): Promise<any | null> {
  if (isRedisConnected && redis) {
    try {
      const val = await redis.get(key);
      if (val) {
  // Log de desenvolvimento removido em produção pelo AutoPatch
        return JSON.parse(val);
      }
    } catch (err: unknown) {
      console.warn("[LicitaPro Redis Cache] Falha ao ler do Redis:", err.message);
    }
  }
  
  const cached = apiCache.get(key);
  if (cached && cached.expiry > Date.now()) {
  // Log de desenvolvimento removido em produção pelo AutoPatch
    return cached.data;
  }
  if (cached) {
    apiCache.delete(key);
  }
  return null;
}

export async function setCachedData(key: string, data: unknown, ttlMs: number = 10 * 60 * 1000) {
  if (isRedisConnected && redis) {
    try {
      const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  // Log de desenvolvimento removido em produção pelo AutoPatch
      return;
    } catch (err: unknown) {
      console.warn("[LicitaPro Redis Cache] Falha ao gravar no Redis:", err.message);
    }
  }

  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
  // Log de desenvolvimento removido em produção pelo AutoPatch
}

export function getCacheSize(): number {
  return Array.from(apiCache.keys()).length;
}
