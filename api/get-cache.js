import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    try {
        // Rút dữ liệu Não Nhện đã được cào sẵn từ KV
        const cachedData = await kv.get('vinhloc_global_cache') || {};
        res.status(200).json(cachedData);
    } catch (error) {
        res.status(500).json({ error: "Lỗi kết nối Não Nhện", details: error.message });
    }
}