import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // URL Web App của Google Apps Script (Nhớ thay bằng URL thực tế của bạn)
    const gasUrl = "URL_APPSCRIPT_CUA_BAN_O_DAY"; 
    
    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'spiderCrawlFull' }) 
        });
        
        const freshData = await response.json();
        
        if (freshData.success) {
            // Cập nhật thành công, lưu đè dữ liệu mới vào bộ nhớ siêu tốc
            await kv.set('vinhloc_global_cache', freshData.data);
            res.status(200).json({ success: true, message: "Nhện đã cào và cập nhật Vercel KV thành công!" });
        } else {
            res.status(500).json({ error: "Google Apps Script từ chối cung cấp dữ liệu" });
        }
    } catch (error) {
        res.status(500).json({ error: "Đứt cáp khi nhện đang cào data" });
    }
}