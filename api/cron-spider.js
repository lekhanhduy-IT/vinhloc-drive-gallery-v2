import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {

  const gasUrl =
    "https://script.google.com/macros/s/AKfycbx3xI-bNWfeffsEH-iIc0yYfF9bHYvAiKZKWIfco6j7Z7GOtOAv7Q8WE1_y9xjen7c/exec";

  try {

    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "spiderCrawlFull"
      })
    });

    const freshData = await response.json();

    if (!freshData.success) {
      return res.status(500).json({
        error: "Apps Script không trả dữ liệu"
      });
    }

    await redis.set(
      "vinhloc_global_cache",
      freshData.data
    );

    return res.status(200).json({
      success: true,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });

  }

}