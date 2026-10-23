exports.handler = async function(event, context) {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

    try {
        if (!event.body) throw new Error("Không tìm thấy gói dữ liệu.");
        
        const body = JSON.parse(event.body);
        const userMessage = body.message;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Chưa có API Key trong Netlify.");

        // Sử dụng chính xác định danh model lõi ổn định nhất: gemini-1.5-flash
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            const googleError = data.error ? data.error.message : `HTTP ${response.status}`;
            return { statusCode: 200, headers, body: JSON.stringify({ reply: `Lỗi API Google: ${googleError}` }) };
        }

        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) throw new Error("Dữ liệu từ Google bị rỗng.");

        return { statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        return { statusCode: 200, headers, body: JSON.stringify({ reply: `Lỗi hệ thống: ${error.message}` }) };
    }
};
