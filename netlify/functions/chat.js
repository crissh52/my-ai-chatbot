exports.handler = async function(event, context) {
    // Chặn các request không hợp lệ
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const body = JSON.parse(event.body);
    const userMessage = body.message;

    try {
        // Lấy API Key từ két sắt Netlify
        const apiKey = process.env.GEMINI_API_KEY; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        // Gửi qua Google
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] })
        });

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;

        // Trả về cho Frontend
        return { statusCode: 200, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ reply: "Lỗi Serverless Backend." }) };
    }
}
