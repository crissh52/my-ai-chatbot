
"use strict";

// CHATBOT GEMINI - FREE TIER OPTIMIZED
// Netlify Functions - CommonJS

const MODELS = [
  { id: "gemini-3.8-flash", thinking: "medium" },
  { id: "gemini-3.6-flash", thinking: "low" },
  { id: "gemini-3.5-flash-lite", thinking: "minimal" }
];

const SYSTEM_PROMPT = `
Bạn là một trợ lý AI cá nhân thông minh, thực tế và hữu ích.

Nguyên tắc:
- Trả lời bằng ngôn ngữ mà người dùng sử dụng.
- Ưu tiên tính chính xác, logic và dễ hiểu.
- Không bịa thông tin, số liệu hoặc nguồn tham khảo.
- Nếu không chắc chắn, hãy nói rõ.
- Với câu hỏi đơn giản, trả lời trực tiếp.
- Với bài toán khó, lập trình hoặc phân tích, giải thích có cấu trúc.
- Khi viết code, ưu tiên code chạy được, an toàn và dễ bảo trì.
- Không khẳng định có thông tin thời gian thực nếu chưa được cung cấp.
- Không tự nhận có khả năng truy cập internet.
- Ghi nhớ ngữ cảnh hội thoại nếu được gửi kèm.
`;

const ORIGIN = "https://my-ai-bot-sh.netlify.app";

const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function send(reply, extra = {}) {
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ reply, ...extra })
  };
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .map(item => {
      const role =
        item?.role === "model" || item?.role === "assistant"
          ? "model"
          : item?.role === "user"
            ? "user"
            : null;

      const text =
        typeof item?.text === "string"
          ? item.text
          : typeof item?.content === "string"
            ? item.content
            : "";

      if (!role || !text.trim()) return null;

      return {
        role,
        parts: [{ text: text.trim().slice(0, 2500) }]
      };
    })
    .filter(Boolean);
}

function canFallback(status, message) {
  if ([404, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  if ([400, 403].includes(status)) {
    return /model|not available|not supported|not found/i.test(
      message || ""
    );
  }

  return false;
}

async function askGemini({
  model,
  apiKey,
  contents,
  mode,
  signal
}) {
  const thinkingLevel =
    mode === "deep"
      ? "high"
      : mode === "fast"
        ? "low"
        : model.thinking;

  const maxOutputTokens = mode === "deep" ? 8192 : 4096;

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model.id) +
    ":generateContent";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents,
      generationConfig: {
        maxOutputTokens,
        thinkingConfig: {
          thinkingLevel
        }
      }
    }),
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const error = new Error(
      data.error?.message || `HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const reply = parts
    .filter(part => typeof part.text === "string" && !part.thought)
    .map(part => part.text)
    .join("\n")
    .trim();

  if (!reply) {
    throw new Error(
      "Gemini không trả về nội dung. " +
      (candidate?.finishReason || "")
    );
  }

  return {
    reply,
    model: model.id,
    usage: {
      input: data.usageMetadata?.promptTokenCount || 0,
      output: data.usageMetadata?.candidatesTokenCount || 0,
      total: data.usageMetadata?.totalTokenCount || 0
    }
  };
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: HEADERS,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({
        reply: "Chỉ hỗ trợ POST.",
        error: true
      })
    };
  }

  const controller = new AbortController();

  // Tổng giới hạn xử lý để tránh treo Netlify Function.
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const rawBody = event.body || "";

    if (rawBody.length > 30000) {
      return send(
        "Nội dung yêu cầu quá dài.",
        { error: true }
      );
    }

    let body;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return send(
        "Dữ liệu gửi lên không đúng định dạng JSON.",
        { error: true }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return send(
        "Chưa cấu hình GEMINI_API_KEY trên Netlify.",
        { error: true }
      );
    }

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return send(
        "Bạn chưa nhập câu hỏi.",
        { error: true }
      );
    }

    if (message.length > 10000) {
      return send(
        "Câu hỏi quá dài. Hãy rút gọn nội dung.",
        { error: true }
      );
    }

    const mode = ["fast", "balanced", "deep"].includes(body.mode)
      ? body.mode
      : "balanced";

    const history = cleanHistory(body.history);

    // Tránh lặp câu hỏi cuối nếu frontend đã đưa vào history.
    const last = history[history.length - 1];

    if (
      last?.role === "user" &&
      last?.parts?.[0]?.text === message
    ) {
      history.pop();
    }

    const contents = [
      ...history,
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    let lastError = null;

    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];

      try {
        const result = await askGemini({
          model,
          apiKey,
          contents,
          mode,
          signal: controller.signal
        });

        console.log("Gemini success:", {
          model: result.model,
          tokens: result.usage.total
        });

        return send(result.reply, {
          model: result.model,
          mode,
          usage: result.usage,
          fallback: i > 0
        });

      } catch (error) {
        lastError = error;

        console.warn("Gemini model failed:", {
          model: model.id,
          status: error.status || "network"
        });

        // Không thử model khác khi key bị từ chối
        // hoặc request không hợp lệ.
        if (
          controller.signal.aborted ||
          !canFallback(error.status, error.message)
        ) {
          break;
        }
      }
    }

    if (controller.signal.aborted) {
      return send(
        "Gemini phản hồi quá lâu. Hãy thử lại.",
        { error: true }
      );
    }

    if (lastError?.status === 429) {
      return send(
        "Các model đang chạm giới hạn API miễn phí. " +
        "Hãy thử lại sau và kiểm tra quota trong Google AI Studio.",
        { error: true }
      );
    }

    console.error("Gemini request unsuccessful:", {
      status: lastError?.status,
      message: lastError?.message
    });

    return send(
      "Không thể kết nối với Gemini. " +
      (lastError?.status
        ? `Mã lỗi: ${lastError.status}.`
        : "Vui lòng thử lại."),
      { error: true }
    );

  } catch (error) {
    console.error("Function error:", error.message);

    return send(
      "Đã xảy ra lỗi xử lý yêu cầu. Vui lòng thử lại.",
      { error: true }
    );

  } finally {
    clearTimeout(timeoutId);
  }
};
