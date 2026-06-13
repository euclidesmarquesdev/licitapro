import express from "express";
import { redis, isRedisConnected } from "../config/redis";

const ipRequests = new Map<string, { count: number; resetTime: number }>();

export async function rateLimiterMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown-ip";
  const limitWindowSeconds = 60;
  const maxRequests = 60;
  const now = Date.now();

  // 1. Try Redis Rate-Limit counter matching
  if (isRedisConnected && redis) {
    try {
      const redisKey = `ratelimit:${ip}`;
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, limitWindowSeconds);
      const mResult = await multi.exec();
      
      if (mResult && mResult[0] && mResult[0][1] !== undefined) {
        const currentCount = mResult[0][1] as number;
        if (currentCount > maxRequests) {
          return res.status(429).json({
            error: "LicitaPro Security Shield: Limite de requisições excedido via Redis. Limite: 60 requisições/min por endereço IP para prevenção de abusos."
          });
        }
        return next();
      }
    } catch (redisErr: any) {
      console.warn("[LicitaPro RateLimiter] Falha na validação Redis, recorrendo ao cache local:", redisErr.message);
    }
  }

  // 2. Local memory fallback implementation
  const record = ipRequests.get(ip);
  const windowMs = limitWindowSeconds * 1000;
  if (!record) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (now > record.resetTime) {
    ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return res.status(429).json({
      error: "LicitaPro Security Shield: Limite de requisições excedido. Limite: 60 requisições/min por endereço IP para prevenção de abusos."
    });
  }
  next();
}
