"use strict";
const el = (id) => document.getElementById(id);
const set = (id, value) => { el(id).textContent = value; };
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa biết";
const errors = {
  github_limit_or_denied: "GitHub đang giới hạn hoặc từ chối lượt đọc. Chờ thời điểm kiểm tra tiếp theo.",
  github_unavailable: "GitHub chưa trả được dữ liệu hợp lệ.",
  github_invalid_response: "Phản hồi GitHub chưa đạt kiểm tra dữ liệu.",
  github_connection_failed: "Chưa kết nối được GitHub. Kiểm tra kết nối mạng.",
};

el("refresh").addEventListener("click", async () => {
  const button = el("refresh");
  button.disabled = true;
  set("notice", "Đang đọc trạng thái public từ GitHub…");
  try {
    const response = await fetch("/api/project-zero", { cache: "no-store", signal: AbortSignal.timeout(35000) });
    if (!response.ok) throw new Error("local_unavailable");
    const result = await response.json();
    set("quota", result.quota.remaining === null ? "Chưa biết" : String(result.quota.remaining));
    set("next-check", date(result.nextCheckAt));
    if (result.snapshot) {
      const { main, pull, check, observedAt } = result.snapshot;
      set("observed", date(observedAt));
      set("main-sha", main.sha);
      set("pr-sha", pull.sha);
      set("main-state", main.protected ? "Có bảo vệ nhánh" : "Chưa thấy bảo vệ nhánh");
      set("main-detail", "Đây là trạng thái Git; không xác nhận commit đang chạy trên Netlify.");
      set("pr-state", pull.merged ? "Đã merge" : pull.state === "closed" ? "Đã đóng · chưa merge" : pull.draft ? "Draft · chưa merge" : "Đang mở");
      set("pr-detail", `${pull.title} · ${pull.branch} → ${pull.base} · ${pull.changedFiles ?? "?"} file`);
      set("ci-state", !check ? "Chưa thấy check" : check.status !== "completed" ? "Đang chạy / chờ" : check.conclusion === "success" ? "Thành công" : `Kết quả: ${check.conclusion || "chưa rõ"}`);
      set("ci-detail", result.snapshot.checksTruncated ? "Danh sách check bị cắt; cần xem GitHub để đối chiếu đầy đủ." : "Health contract tests tại commit PR; không suy ra mọi kiểm tra khác đều đạt.");
    }
    if (result.error) {
      set("notice", `${errors[result.error] || "Chưa lấy được trạng thái mới."}${result.status === "stale" ? " Đang giữ bằng chứng cũ bên dưới, không coi là kết quả mới." : ""}`);
    } else set("notice", result.cached ? "Đang dùng bằng chứng trong bộ nhớ đệm 2 phút để tiết kiệm lượt API." : "Đã đọc bằng chứng mới từ GitHub. Không có thay đổi nào được gửi lên dự án.");
  } catch {
    set("notice", "Chưa đọc được bản local hoặc GitHub. Dữ liệu đang hiển thị không được xác nhận mới.");
  } finally { button.disabled = false; }
});
