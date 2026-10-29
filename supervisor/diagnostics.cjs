"use strict";

function diagnose(result) {
  const snapshot = result?.snapshot;
  const findings = [];
  function add(id, level, fact, nextStep) {
    findings.push({ id, level, fact, nextStep, autoExecuted: false });
  }
  if (result?.status !== "observed" || !snapshot) {
    add("fresh_evidence_required", "warning",
      snapshot ? "Chỉ có bằng chứng cũ; chưa xác nhận được trạng thái mới." : "Chưa có bằng chứng GitHub hợp lệ.",
      "Xem thông báo kết nối hoặc giới hạn API, chờ thời điểm cho phép rồi kiểm tra lại. Không kết luận CI hoặc triển khai hiện đang đạt.");
  } else {
    if (snapshot.main.protected) add("main_protected", "pass", "GitHub báo main đang được bảo vệ.",
      "Giữ quy tắc bảo vệ. Thông tin này chưa chứng minh mọi tùy chọn bảo vệ chi tiết hoặc quyền truy cập đều đúng.");
    else add("main_unprotected", "warning", "GitHub báo main chưa được bảo vệ.",
      "Chủ sở hữu kiểm tra Settings → Branches/rules. Chưa merge hoặc phát hành trước khi đối chiếu quy tắc.");
    const pull = snapshot.pull;
    if (pull.merged) add("pull_merged", "info", `PR #${pull.number} đã merge theo GitHub.`,
      "Đối chiếu commit/deploy thực tế trên Netlify; merge không chứng minh bản mới đã được phát hành.");
    else if (pull.state === "closed") add("pull_closed", "info", `PR #${pull.number} đã đóng và chưa merge.`,
      "Đọc lý do đóng PR trước khi đề xuất khôi phục hoặc mở PR khác.");
    else add("pull_pending", "info", `PR #${pull.number} ${pull.draft ? "đang Draft" : "đang mở"}, chưa merge.`,
      "Giữ riêng bản thử; chỉ xem xét phát hành sau review, kiểm chứng triển khai, kiểm tra ngân sách và phê duyệt của chủ sở hữu.");
    const check = snapshot.check;
    if (!check) add("ci_unknown", "warning", "Chưa thấy Health contract tests tại commit PR.",
      "Mở tab Checks của PR, kiểm tra workflow và commit; không coi việc thiếu check là thành công.");
    else if (check.status !== "completed") add("ci_pending", "info", "Check CI đang chờ hoặc đang chạy.",
      "Chờ check kết thúc rồi đọc kết quả tại cùng commit.");
    else if (check.conclusion === "success") add("ci_pass", "pass", "Health contract tests đã thành công tại commit PR.",
      "Đây là bằng chứng cho check này; vẫn cần review và kiểm chứng môi trường triển khai.");
    else add("ci_attention", "warning", `Check CI đã kết thúc với kết quả ${check.conclusion || "chưa rõ"}.`,
      "Mở Checks, đọc bước lỗi và log đã che thông tin nhạy cảm; sửa trên feature branch rồi kiểm thử lại. Chưa merge.");
    if (snapshot.checksTruncated) add("checks_incomplete", "warning", "Danh sách check nhận về chưa đầy đủ.",
      "Đối chiếu toàn bộ check trên GitHub trước khi đánh giá trạng thái PR.");
    add("deployment_unverified", "info", "Module local chưa kiểm tra trạng thái triển khai Netlify.",
      "Giữ trạng thái triển khai là chưa xác minh. Kiểm tra quota và xin phê duyệt trước thao tác phát hành; không tự trigger deploy.");
  }
  return { engine: "rules-v1", observedAt: snapshot?.observedAt || null,
    evidenceState: result?.status || "unavailable", actionsExecuted: false,
    summary: findings.some((f) => f.level === "warning") ? "Cần đối chiếu thêm" : "Có bằng chứng; còn bước xác minh triển khai",
    findings };
}

module.exports = { diagnose };
