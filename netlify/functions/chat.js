exports.handler = async function(event, context) {
    // 1. Cấu hình Headers (Chống lỗi bảo mật CORS khi trình duyệt kiểm tra chéo)
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    // 2. Mở cửa cho Preflight Request (Cơ chế an toàn mặc định của mọi trình duyệt)
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

    // 3. Đánh chặn mọi kết nối không hợp lệ
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: JSON.stringify({ reply: "Lỗi Backend: Chỉ chấp nhận phương thức POST." }) };
    }

    try {
        // 4. Kiểm duyệt dữ liệu đầu vào cực ngặt
        if (!event.body) throw new Error("Không tìm thấy gói dữ liệu gửi lên.");
        
        const body = JSON.parse(event.body);
        const userMessage = body.message;

        if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
            throw new Error("Câu hỏi trống hoặc sai định dạng kỹ thuật.");
        }

        // 5. Kiểm tra chìa khóa két sắt
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("Hệ thống Netlify chưa được cấp biến GEMINI_API_KEY.");
        }

        // 6. Gọi API với công tắc ngắt khẩn cấp (Timeout) chống kẹt loading vĩnh viễn
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 15000); // Tự hủy nếu Google treo quá 15 giây

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] }),
            signal: abortController.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        // 7. Bóc tách lỗi từ chính máy chủ Google (Lỗi key, hết quota, cấm truy cập...)
        if (!response.ok || data.error) {
            const googleError = data.error ? data.error.message : `Mã lỗi HTTP ${response.status}`;
            console.error("[Lỗi từ Google]:", googleError);
            // Trả statusCode 200 để Frontend bắt được chữ và in ra màn hình đỏ
            return { statusCode: 200, headers, body: JSON.stringify({ reply: `Lỗi API Google: ${googleError}` }) };
        }

        // 8. Định vị chính xác câu trả lời (Dùng optional chaining '?.' chống lỗi đọc biến null)
        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) throw new Error("Google trả về dữ liệu rỗng hoặc sai cấu trúc lõi.");

        // 9. Hoàn thành xuất sắc
        return { statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        console.error("[Lỗi hệ thống]:", error);
        
        // Nhận diện riêng lỗi đứt cáp / treo mạng
        let errorMessage = error.message;
        if (error.name === 'AbortError') errorMessage = "Máy chủ Google phản hồi quá chậm. Đã tự ngắt kết nối để bảo vệ web.";

        return { statusCode: 200, headers, body: JSON.stringify({ reply: `Hệ thống báo lỗi: ${errorMessage}` }) };
    }
};
