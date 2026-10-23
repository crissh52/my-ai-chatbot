exports.handler = async function(event, context) {
    // 1. Mở khóa CORS cho mọi luồng kết nối
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ reply: "Lỗi: Chỉ nhận POST." }) };

    try {
        if (!event.body) throw new Error("Gói dữ liệu rỗng.");
        const userMessage = JSON.parse(event.body).message;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("Netlify chưa nhận được API Key. Hãy check lại Environment Variables.");
        if (!userMessage) throw new Error("Không nhận được câu hỏi từ người dùng.");

        // Dùng model thế hệ mới nhất, nhanh và chuẩn nhất hiện tại
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        // Cài đặt bộ đếm giờ: Tự hủy sau 8 giây để tránh Netlify báo lỗi Timeout 10s ngầm
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        // Bắt mọi lỗi từ Google trả về
        if (!response.ok || data.error) {
            const errDetail = data.error ? data.error.message : `Mã HTTP ${response.status}`;
            throw new Error(`Google từ chối: ${errDetail}`);
        }

        // Trích xuất chuẩn xác text (chống sập nếu JSON đổi cấu trúc)
        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) throw new Error("Google phản hồi thành công nhưng không có chữ.");

        return { statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        let errorMsg = error.message;
        if (error.name === 'AbortError') errorMsg = "Mạng quá tải hoặc Google phản hồi chậm hơn 8 giây. Đã tự ngắt.";
        // Trả về code 200 để ép Frontend in thông báo lỗi chi tiết ra màn hình
        return { statusCode: 200, headers, body: JSON.stringify({ reply: `[BÁO LỖI]: ${errorMsg}` }) };
    }
};
