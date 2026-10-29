"use strict";
const el = (id) => document.getElementById(id);
const set = (id, value) => { el(id).textContent = value; };
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa biết";
let latestReport = null;
const historyLabels = { mainSha: "Commit main", mainProtected: "Bảo vệ main", pullSha: "Commit PR",
  pullState: "Trạng thái PR", draft: "Draft", merged: "Đã merge", ciStatus: "Trạng thái CI", ciConclusion: "Kết quả CI" };
function renderHistory(history) {
  const list = el("history-list"); list.replaceChildren();
  if (history.status !== "available") {
    set("history-state", "Chưa đọc/lưu được lịch sử. File cũ được giữ nguyên; trạng thái GitHub vẫn được báo riêng.");
    set("history-change", "Chưa thể so sánh lịch sử."); return;
  }
  set("history-state", `${history.items.length} lần quan sát đã lưu trên máy, tối đa ${history.retention}. Đây là lịch sử, không phải trạng thái vừa kiểm tra.`);
  set("history-change", !history.comparisonAvailable ? "Cần hai lần quan sát khác thời điểm để so sánh."
    : !history.changes.length ? "Hai lần gần nhất: không thấy thay đổi trong các trường trạng thái đã lưu."
    : history.changes.map((c) => `${historyLabels[c.field] || c.field}: ${String(c.before ?? "chưa biết")} → ${String(c.after ?? "chưa biết")}`).join(" · "));
  for (const item of history.items) {
    const row = document.createElement("li");
    row.textContent = `${date(item.observedAt)} · main ${item.mainSha.slice(0, 7)} · PR ${item.pullSha.slice(0, 7)} · CI ${item.ciConclusion || item.ciStatus || "chưa biết"}`;
    list.append(row);
  }
}
async function loadHistory() {
  try {
    const response = await fetch("/api/history", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("local_history_unavailable");
    renderHistory(await response.json());
  } catch { set("history-state", "Chưa đọc được lịch sử local. Chưa gọi GitHub."); }
}
loadHistory();
function renderAnalysis(analysis) {
  set("analysis-summary", analysis.summary);
  const list = el("findings");
  list.replaceChildren();
  for (const finding of analysis.findings) {
    const row = document.createElement("li");
    const fact = document.createElement("strong");
    const next = document.createElement("p");
    fact.textContent = `${finding.level === "warning" ? "Cần chú ý" : finding.level === "pass" ? "Đã quan sát" : "Còn bước tiếp"}: ${finding.fact}`;
    next.textContent = `Đề xuất: ${finding.nextStep}`;
    row.append(fact, next); list.append(row);
  }
}
el("export").addEventListener("click", () => {
  if (!latestReport) return;
  const content = JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), report: latestReport }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = "supervisor-project-zero-report.json";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const errors = {
  github_limit_or_denied: "GitHub đang giới hạn hoặc từ chối lượt đọc. Chờ thời điểm kiểm tra tiếp theo.",
  github_unavailable: "GitHub chưa trả được dữ liệu hợp lệ.",
  github_invalid_response: "Phản hồi GitHub chưa đạt kiểm tra dữ liệu.",
  github_connection_failed: "Chưa kết nối được GitHub. Kiểm tra kết nối mạng.",
};

el("refresh").addEventListener("click", async () => {
  const button = el("refresh");
  button.disabled = true;
  el("export").disabled = true;
  set("notice", "Đang đọc trạng thái public từ GitHub…");
  try {
    const response = await fetch("/api/project-zero", { cache: "no-store", signal: AbortSignal.timeout(35000) });
    if (!response.ok) throw new Error("local_unavailable");
    const result = await response.json();
    latestReport = result;
    renderAnalysis(result.analysis);
    renderHistory(result.history);
    el("export").disabled = false;
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
    latestReport = null;
    set("analysis-summary", "Chưa nhận được kết quả phân tích mới. Các nhận xét cũ bên dưới không được xác nhận lại.");
    set("notice", "Chưa đọc được bản local hoặc GitHub. Dữ liệu đang hiển thị không được xác nhận mới.");
  } finally { button.disabled = false; }
});
