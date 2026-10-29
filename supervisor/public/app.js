"use strict";
const el = (id) => document.getElementById(id);
const set = (id, value) => { el(id).textContent = value; };
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa biết";
let latestReport = null;
let taskToken = null;
let authToken = null;
let authMode = null;
let unlocked = false;
let lastInteraction = Date.now();
let lastActivitySent = Date.now();
let lockPending = false;
let statusPending = false;
const IDLE_MS = 5 * 60 * 1000;
const lockChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("supervisor-local-lock") : null;
function clearPasswords() { el("auth-password").value = ""; el("auth-confirm").value = ""; }
function hidePrivateView() {
  unlocked = false; el("workspace").hidden = true; latestReport = null; taskToken = null; el("export").disabled = true;
  for (const id of ["task-list", "history-list", "findings", "project-list"]) el(id).replaceChildren();
  for (const id of ["main-state", "pr-state", "ci-state"]) set(id, "Chưa kiểm tra");
  for (const id of ["main-sha", "pr-sha", "observed", "quota", "next-check"]) set(id, "—");
  el("task-title").value = "";
  el("project-name").value = ""; el("project-repo").value = "";
  projectItems = [];
  clearPasswords();
}
async function lockSession() {
  if (lockPending) return;
  lockPending = true; hidePrivateView(); el("logout").disabled = true;
  try {
    await authRequest({ action: "logout" }); lockChannel?.postMessage({ type: "locked" }); location.reload();
  } catch {
    set("auth-notice", "Đã ẩn dữ liệu nhưng chưa xác nhận thu hồi phiên. Dừng server local để kết thúc phiên.");
    el("logout").disabled = false; lockPending = false;
  }
}
async function checkSession() {
  if (!unlocked || statusPending) return;
  statusPending = true;
  try {
    const response = await fetch("/api/auth", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok || !(await response.json()).authenticated) { hidePrivateView(); location.reload(); }
  } catch { hidePrivateView(); set("auth-notice", "Chưa xác nhận được phiên local. Dữ liệu đã được ẩn; tải lại trang để kiểm tra."); }
  finally { statusPending = false; }
}
function noteInteraction(event) {
  if (!unlocked || !event.isTrusted) return;
  if (Date.now() - lastInteraction >= IDLE_MS) { void lockSession(); return; }
  lastInteraction = Date.now();
  if (Date.now() - lastActivitySent >= 30000) {
    lastActivitySent = Date.now();
    void authRequest({ action: "activity" }).catch(() => { hidePrivateView(); location.reload(); });
  }
}
for (const type of ["pointerdown", "keydown", "pointermove", "scroll"]) document.addEventListener(type, noteInteraction, { passive: true });
window.addEventListener("pageshow", (event) => {
  clearPasswords();
  if (event.persisted) { hidePrivateView(); location.reload(); return; }
  void checkSession();
});
window.addEventListener("pagehide", () => { hidePrivateView(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { clearPasswords(); void checkSession(); }
});
if (lockChannel) lockChannel.onmessage = (event) => { if (event.data?.type === "locked") { hidePrivateView(); location.reload(); } };
setInterval(() => {
  if (!unlocked) return;
  if (Date.now() - lastInteraction >= IDLE_MS) void lockSession(); else void checkSession();
}, 15000);
async function syncAuth() {
  clearPasswords();
  el("auth-form").hidden = true; el("workspace").hidden = true; el("logout").hidden = true;
  latestReport = null; taskToken = null;
  try {
    const response = await fetch("/api/auth", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("auth_unavailable");
    const state = await response.json(); authToken = state.csrfToken;
    if (state.authenticated) {
      unlocked = true; lastInteraction = Date.now(); lastActivitySent = Date.now();
      el("workspace").hidden = false; el("logout").hidden = false;
      set("auth-title", "Phiên Supervisor local"); set("auth-notice", "Tự khóa sau 5 phút không hoạt động; phiên tối đa 8 giờ hoặc kết thúc khi server khởi động lại. Dùng Khóa ngay hoặc Win+L khi rời máy.");
      await Promise.all([loadTasks(), loadHistory(), loadProjects()]);
    } else {
      authMode = state.configured ? "login" : "setup";
      el("auth-form").hidden = false;
      el("auth-confirm").hidden = state.configured; el("confirm-label").hidden = state.configured;
      el("auth-confirm").required = !state.configured;
      el("auth-password").autocomplete = state.configured ? "off" : "new-password";
      clearPasswords();
      set("auth-title", state.configured ? "Đăng nhập Supervisor local" : "Đặt mật khẩu cho Supervisor local");
      set("auth-submit", state.configured ? "Đăng nhập" : "Tạo mật khẩu local");
      set("auth-notice", state.configured ? "Đăng nhập để mở trạng thái, lịch sử và công việc. Dữ liệu đã lưu được giữ nguyên." : "Lần đầu: bạn tự đặt mật khẩu 15–128 ký tự, lưu ở nơi an toàn. Không dùng mật khẩu này cho tài khoản khác.");
    }
  } catch { authMode = null; set("auth-notice", "Chưa đọc được cấu hình đăng nhập. Không tự xóa hoặc ghi đè file cũ; cần kiểm tra local."); }
}
async function authRequest(body) {
  const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json", "X-Supervisor-CSRF": authToken },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "auth_unavailable");
}
el("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!authMode) return;
  if (authMode === "setup" && el("auth-password").value !== el("auth-confirm").value) { set("auth-notice", "Hai lần nhập mật khẩu chưa khớp."); return; }
  el("auth-submit").disabled = true;
  try { await authRequest({ action: authMode, password: el("auth-password").value }); location.reload(); }
  catch (error) {
    const messages = { auth_invalid_login: "Mật khẩu chưa đúng.", auth_password_invalid: "Cần mật khẩu từ 15 đến 128 ký tự.",
      auth_try_later: "Đang xử lý hoặc tạm chặn đăng nhập. Nếu đã sai 5 lần, chờ 15 phút.",
      auth_already_configured: "Mật khẩu đã được tạo. Tải lại trang để đăng nhập." };
    set("auth-notice", messages[error.message] || "Chưa đăng nhập được. Kiểm tra local; không xóa file dữ liệu.");
  } finally { clearPasswords(); el("auth-submit").disabled = false; }
});
el("logout").addEventListener("click", () => { void lockSession(); });
const taskStates = { todo: "Cần làm", doing: "Đang làm", done: "Bạn đánh dấu xong" };
let projectItems = [];
function renderProjects() {
  const list = el("project-list"); list.replaceChildren();
  for (const project of projectItems.filter((p) => !p.archived || el("project-show-archived").checked)) {
    const row = document.createElement("li"); const content = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = project.name;
    const detail = document.createElement("p"); detail.textContent = `${project.repository || "Chưa khai báo repo"} · ${project.builtin ? "Project Zero — dashboard bên dưới" : "Chưa kết nối"}${project.archived ? " · Đã ẩn" : ""}`;
    content.append(title, detail); row.append(content);
    if (!project.builtin) {
      const button = document.createElement("button"); button.textContent = project.archived ? "Khôi phục" : "Ẩn dự án";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await mutateProject({ action: "archive", id: project.id, archived: !project.archived }); }
        catch { button.disabled = false; }
      }); row.append(button);
    }
    list.append(row);
  }
}
async function loadProjects() {
  try {
    const response = await fetch("/api/projects", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (response.status === 401) { location.reload(); return; }
    if (!response.ok) throw new Error("projects_unavailable");
    projectItems = (await response.json()).projects; renderProjects();
    set("project-notice", `${projectItems.length}/20 dự án đã đăng ký trên máy. Dự án mới chưa cấp quyền kết nối.`);
  } catch { set("project-notice", "Chưa đọc được danh sách dự án. Dữ liệu cũ được giữ nguyên."); }
}
async function mutateProject(body) {
  try {
    const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json", "X-Supervisor-CSRF": authToken },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    if (response.status === 401) { location.reload(); throw new Error("session_expired"); }
    const result = await response.json();
    if (!response.ok) {
      const messages = { projects_duplicate: "Repo đã có, kể cả trong danh sách đã ẩn. Bật Hiện dự án đã ẩn để khôi phục.",
        projects_limit: "Đã đủ 20 dự án. Ẩn không xóa dữ liệu hoặc giải phóng giới hạn.",
        projects_invalid_input: "Tên tối đa 80 ký tự; repo có thể trống, nếu nhập cần dạng owner/repo. Không nhập URL, token hoặc key." };
      set("project-notice", messages[result.error] || "Chưa lưu được dự án; dữ liệu cũ được giữ nguyên.");
      throw new Error("project_write_failed");
    }
    projectItems = result.projects; renderProjects(); set("project-notice", "Đã lưu trên máy. Chưa tạo kết nối hoặc gọi dịch vụ ngoài.");
  } catch (error) {
    if (!["project_write_failed", "session_expired"].includes(error.message)) set("project-notice", "Chưa xác nhận lưu thành công; tải lại trang để đối chiếu trước khi thử lại.");
    throw error;
  }
}
el("project-show-archived").addEventListener("change", renderProjects);
el("project-form").addEventListener("submit", async (event) => {
  event.preventDefault(); el("project-add").disabled = true;
  try { await mutateProject({ action: "create", name: el("project-name").value, repository: el("project-repo").value });
    el("project-name").value = ""; el("project-repo").value = ""; }
  catch {} finally { el("project-add").disabled = false; }
});
function renderTasks(tasks) {
  const list = el("task-list"); list.replaceChildren();
  for (const task of tasks) {
    const row = document.createElement("li"); const title = document.createElement("span");
    title.textContent = task.title;
    const select = document.createElement("select"); select.setAttribute("aria-label", `Trạng thái: ${task.title}`);
    for (const [value, label] of Object.entries(taskStates)) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
    }
    select.value = task.status;
    select.addEventListener("change", async () => {
      select.disabled = true;
      try { await mutateTask({ action: "status", id: task.id, status: select.value }); }
      catch { select.value = task.status; select.disabled = false; }
    });
    row.append(title, select); list.append(row);
  }
}
async function loadTasks() {
  try {
    const response = await fetch("/api/tasks", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (response.status === 401) { location.reload(); return; }
    if (!response.ok) throw new Error("tasks_unavailable");
    const result = await response.json(); taskToken = result.csrfToken; renderTasks(result.tasks);
    set("task-notice", `${result.tasks.length}/100 công việc trên máy. Trạng thái do bạn xác nhận.`);
  } catch { taskToken = null; set("task-notice", "Chưa đọc được công việc. File cũ được giữ nguyên; hãy kiểm tra bản local."); }
}
async function mutateTask(body) {
  if (!taskToken) { set("task-notice", "Cần tải lại trang để lấy phiên local mới."); throw new Error("no_local_token"); }
  try {
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", "X-Supervisor-CSRF": taskToken },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) { location.reload(); throw new Error("task_write_failed"); }
      set("task-notice", result.error === "tasks_limit" ? "Đã đủ 100 công việc; không tự xóa công việc cũ."
        : "Chưa lưu được công việc. Kiểm tra tên tối đa 160 ký tự hoặc tải lại trang; dữ liệu cũ được giữ nguyên.");
      throw new Error("task_write_failed");
    }
    renderTasks(result.tasks); set("task-notice", `Đã lưu trên máy · ${result.tasks.length}/100 công việc. Chưa tự thực thi thao tác kỹ thuật.`);
  } catch (error) { if (error.message !== "task_write_failed") set("task-notice", "Chưa xác nhận lưu thành công. Tải lại trang để đối chiếu trước khi thử lại."); throw error; }
}
el("task-form").addEventListener("submit", async (event) => {
  event.preventDefault(); el("task-add").disabled = true;
  try { await mutateTask({ action: "create", title: el("task-title").value }); el("task-title").value = ""; }
  catch {} finally { el("task-add").disabled = false; }
});
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
    if (response.status === 401) { location.reload(); return; }
    if (!response.ok) throw new Error("local_history_unavailable");
    renderHistory(await response.json());
  } catch { set("history-state", "Chưa đọc được lịch sử local. Chưa gọi GitHub."); }
}
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
    const save = document.createElement("button"); save.textContent = "Thêm vào công việc";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { await mutateTask({ action: "create", title: finding.nextStep.slice(0, 160) }); save.textContent = "Đã thêm công việc"; }
      catch { save.disabled = false; }
    });
    row.append(fact, next, save); list.append(row);
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
    if (response.status === 401) { location.reload(); return; }
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
syncAuth();
