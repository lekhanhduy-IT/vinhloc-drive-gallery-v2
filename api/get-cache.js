import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {

    const cachedData =
      await redis.get("vinhloc_global_cache") || {};

    return res.status(200).json(cachedData);

  } catch (error) {

    return res.status(500).json({
      error: "Lỗi đọc Redis",
      details: error.message
    });

  }
}