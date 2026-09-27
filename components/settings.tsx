"use client";

import { useRef, useState } from "react";
import { CloudDownload, CloudUpload, FileJson2, FileSpreadsheet, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportBackup, importBackup, recordExport } from "@/app/actions";
import { backupSchema, type Backup, type Profile, type WordEntry } from "@/lib/model";

function download(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
function makeCsv(backup: Backup) {
  const columns = ["word", "part_of_speech", "definition", "example", "note", "added_date", "deleted_at", "remembered", "last_reviewed_at"] as const;
  return "\uFEFF" + [columns.join(","), ...backup.entries.map((entry) => [entry.word, entry.part_of_speech, entry.definition, entry.example, entry.note, entry.added_date, entry.deleted_at, entry.review_state?.remembered ?? "", entry.review_state?.last_reviewed_at ?? ""].map(csvCell).join(","))].join("\r\n");
}

export function Settings({ entries, profile, email, onImported, onExported }: {
  entries: WordEntry[]; profile: Profile; email: string; onImported: () => void; onExported: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const knownIds = new Set(entries.map((entry) => entry.id));
  const knownKeys = new Set(entries.filter((entry) => !entry.deleted_at).map((entry) => `${entry.word}|${entry.part_of_speech}|${entry.definition}`.toLowerCase()));
  const newCount = preview?.entries.filter((entry) => !knownIds.has(entry.id) && (entry.deleted_at || !knownKeys.has(`${entry.word}|${entry.part_of_speech}|${entry.definition}`.toLowerCase()))).length ?? 0;

  async function doExport(format: "json" | "csv") {
    setBusy(true); setError(""); setMessage("");
    try {
      const backup = await exportBackup();
      const date = backup.exported_at.slice(0, 10);
      if (format === "json") download(JSON.stringify(backup, null, 2), "application/json", `noteielts-${date}.json`);
      else download(makeCsv(backup), "text/csv;charset=utf-8", `noteielts-${date}.csv`);
      const result = format === "json" ? await recordExport() : { ok: true };
      setMessage(result.ok ? format === "json" ? "Đã tải bản sao xuống thiết bị. Hãy giữ file JSON ở nơi riêng của bạn." : "Đã tải bảng CSV xuống thiết bị. Hãy xuất JSON để có thể khôi phục dữ liệu." : "Đã tải file, nhưng chưa ghi được ngày sao lưu trên cloud.");
      onExported();
    } catch { setError("Không thể xuất dữ liệu. Hãy thử lại khi có mạng."); }
    setBusy(false);
  }
  async function chooseFile(file: File | undefined) {
    setPreview(null); setError(""); setMessage("");
    if (!file) return;
    if (file.size > 1_500_000) { setError("File vượt quá 1,5 MB."); return; }
    try {
      const parsed = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) { setError("File không đúng định dạng sao lưu NoteIelts v1."); return; }
      setPreview(parsed.data);
    } catch { setError("Không đọc được file JSON."); }
  }
  async function doImport() {
    if (!preview) return;
    setBusy(true); setError("");
    const result = await importBackup(preview);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setMessage(`Đã khôi phục ${result.count ?? 0} mục từ mới. Các mục đã có được giữ nguyên.`);
    setPreview(null); if (fileInput.current) fileInput.current.value = "";
    onImported();
  }

  return <><div className="page-heading"><div><span className="eyebrow">KIỂM SOÁT DỮ LIỆU</span><h1>Cài đặt & sao lưu</h1><p>Từ vựng là của bạn. Hãy giữ một bản sao bên ngoài ứng dụng.</p></div></div>
    <div className="settings-grid"><section className="content-card settings-card"><span className="settings-icon"><ShieldCheck size={24} aria-hidden="true" /></span><h2>Tài khoản của bạn</h2><p className="settings-muted">Đăng nhập Google để đồng bộ từ và tiến độ học giữa các thiết bị.</p><div className="detail-row"><span>Email</span><strong>{email}</strong></div><div className="detail-row"><span>Múi giờ ngày ghi từ</span><strong>{profile.timezone}</strong></div><div className="detail-row"><span>Tổng số mục từ</span><strong>{entries.length}</strong></div></section>
      <section className="content-card settings-card"><span className="settings-icon"><CloudDownload size={24} aria-hidden="true" /></span><h2>Xuất bản sao</h2><p className="settings-muted">JSON chứa toàn bộ mục từ, thùng rác và tiến độ ôn; có thể nhập trở lại. CSV để xem trong bảng tính.</p><div className="detail-row"><span>Lần xuất gần nhất</span><strong>{profile.last_export_at ? new Date(profile.last_export_at).toLocaleString("vi-VN") : "Chưa có"}</strong></div><div className="settings-actions"><Button className="h-11" disabled={busy} onClick={() => void doExport("json")}><FileJson2 size={18} aria-hidden="true" /> Tải JSON</Button><Button variant="outline" className="h-11" disabled={busy} onClick={() => void doExport("csv")}><FileSpreadsheet size={18} aria-hidden="true" /> Tải CSV</Button></div></section>
      <section className="content-card settings-card import-card"><span className="settings-icon"><CloudUpload size={24} aria-hidden="true" /></span><h2>Khôi phục từ bản sao</h2><p className="settings-muted">Chọn file JSON đã xuất từ NoteIelts. Mục đang có được giữ nguyên khi trùng ID hoặc cùng từ, loại từ và nghĩa.</p><input ref={fileInput} type="file" accept=".json,application/json" className="file-input" aria-label="Chọn file sao lưu JSON" onChange={(e) => void chooseFile(e.target.files?.[0])} />
        {preview && <div className="import-preview"><strong>Xem trước bản sao</strong><p>{preview.entries.length} mục trong file · dự kiến thêm {newCount} mục mới · {preview.entries.length - newCount} mục giữ nguyên</p><small>Tạo ngày {new Date(preview.exported_at).toLocaleString("vi-VN")}</small><div className="preview-sample">{preview.entries.slice(0, 3).map((entry) => <span key={entry.id}>{entry.word} · {entry.part_of_speech}</span>)}</div><Button className="h-11" disabled={busy} onClick={() => void doImport()}>{busy ? "Đang khôi phục…" : "Nhập các mục mới"}</Button></div>}
      </section><aside className="settings-note"><LockKeyhole size={20} aria-hidden="true" /><div><strong>Giữ dữ liệu lâu dài</strong><p>Hãy lưu file JSON vào kho lưu trữ riêng và xuất lại mỗi tuần khi có thay đổi. Dự án Supabase miễn phí có thể tạm dừng nếu lâu không dùng; dữ liệu trên cloud không thay thế bản sao của bạn.</p></div></aside></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
  </>;
}
