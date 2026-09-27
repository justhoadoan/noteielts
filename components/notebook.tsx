"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, CalendarDays, ChevronRight, CloudDownload, LayoutGrid, Layers3, LogOut, Plus, Search, Settings2, Trash2, RotateCcw, Pencil, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WordForm } from "@/components/word-form";
import { Review } from "@/components/review";
import { Settings } from "@/components/settings";
import { createClient } from "@/lib/supabase/browser";
import { setDeleted } from "@/app/actions";
import { displayDate, localDate, type Profile, type WordEntry } from "@/lib/model";

type View = "today" | "words" | "review" | "settings";
const nav: Array<{ id: View; label: string; icon: typeof LayoutGrid }> = [
  { id: "today", label: "Hôm nay", icon: LayoutGrid },
  { id: "words", label: "Sổ từ", icon: BookOpenText },
  { id: "review", label: "Ôn tập", icon: Layers3 },
  { id: "settings", label: "Cài đặt", icon: Settings2 },
];

export function Notebook({ initialEntries, profile, email, now }: { initialEntries: WordEntry[]; profile: Profile; email: string; now: string }) {
  const router = useRouter();
  const entries = initialEntries;
  const [view, setView] = useState<View>("today");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("all");
  const [trash, setTrash] = useState(false);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const today = localDate(profile.timezone);

  useEffect(() => {
    const syncView = () => { const value = new URLSearchParams(window.location.search).get("view"); setView(nav.some((item) => item.id === value) ? value as View : "today"); };
    syncView(); window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  function go(next: View) { setView(next); window.history.pushState({}, "", next === "today" ? "/" : `/?view=${next}`); }
  const active = entries.filter((item) => !item.deleted_at);
  const todayEntries = active.filter((item) => item.added_date === today);
  const uniqueDays = new Set(active.map((item) => item.added_date)).size;
  const remembered = active.filter((item) => item.review_state?.remembered).length;
  const backupDue = active.length > 0 && (!profile.last_export_at || new Date(now).getTime() - new Date(profile.last_export_at).getTime() > 7 * 86400000) &&
    (!profile.last_export_at || active.some((item) => new Date(item.updated_at).getTime() > new Date(profile.last_export_at!).getTime() || (item.review_state && new Date(item.review_state.last_reviewed_at).getTime() > new Date(profile.last_export_at!).getTime())));

  const filtered = useMemo(() => entries.filter((item) => Boolean(item.deleted_at) === trash &&
    (pos === "all" || item.part_of_speech === pos) &&
    `${item.word} ${item.definition} ${item.note}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => b.added_date.localeCompare(a.added_date) || b.created_at.localeCompare(a.created_at)), [entries, pos, query, trash]);
  const groups = [...new Set(filtered.map((item) => item.added_date))];
  const posOptions = [...new Set(active.map((item) => item.part_of_speech))].sort();
  const editing = editingId ? entries.find((item) => item.id === editingId) : undefined;

  function saved(word: string) { setAdding(false); setEditingId(null); setNotice(`Đã lưu “${word}” lên cloud.`); router.refresh(); }
  function find(id: string) { const item = entries.find((entry) => entry.id === id); setAdding(false); setEditingId(null); setTrash(false); setQuery(item?.word ?? ""); go("words"); }
  async function toggleTrash(item: WordEntry) {
    setBusyId(item.id);
    const result = await setDeleted(item.id, item.version, Boolean(item.deleted_at));
    setBusyId("");
    setNotice(result.ok ? item.deleted_at ? "Đã khôi phục từ." : "Đã chuyển vào thùng rác." : result.error);
    if (result.ok || result.conflict) router.refresh();
  }
  async function signOut() { await createClient().auth.signOut(); router.refresh(); }
  const wordRows = (items: WordEntry[]) => items.map((item) => <article className="word-row" key={item.id} id={`word-${item.id}`}>
    <div className="word-initial" aria-hidden="true">{item.word.charAt(0).toUpperCase()}</div>
    <div className="word-copy"><div className="word-title-row"><h3>{item.word}</h3><Badge variant="secondary">{item.part_of_speech}</Badge>{item.review_state?.remembered && <span className="remembered-mark"><CheckCircle2 size={14} aria-hidden="true" /> Đã nhớ</span>}</div><p>{item.definition}</p>{item.example && <small>“{item.example}”</small>}</div>
    <div className="word-actions">{!item.deleted_at && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Sửa ${item.word}`} title="Sửa" onClick={() => setEditingId(item.id)}><Pencil size={18} aria-hidden="true" /></Button>}<Button variant="ghost" size="icon" className="h-11 w-11" aria-label={item.deleted_at ? `Khôi phục ${item.word}` : `Đưa ${item.word} vào thùng rác`} title={item.deleted_at ? "Khôi phục" : "Chuyển vào thùng rác"} disabled={busyId === item.id} onClick={() => void toggleTrash(item)}>{item.deleted_at ? <RotateCcw size={18} aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</Button></div>
  </article>);

  return <div className="app-layout">
    <a className="skip-link" href="#main-content">Chuyển đến nội dung</a>
    <aside className="sidebar"><div className="brand"><span className="brand-mark">N</span><div><strong>NoteIelts</strong><small>Personal vocabulary</small></div></div>
      <div className="sidebar-section-label">KHÔNG GIAN CỦA BẠN</div><nav className="side-nav" aria-label="Điều hướng chính">{nav.map((item) => <button key={item.id} className={view === item.id ? "nav-link active" : "nav-link"} onClick={() => go(item.id)} aria-current={view === item.id ? "page" : undefined}><item.icon size={19} aria-hidden="true" /><span>{item.label}</span>{item.id === "words" && <span className="nav-count">{active.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer" /><div className="sidebar-tip"><div className="tip-icon"><Layers3 size={18} aria-hidden="true" /></div><strong>Mỗi ngày một chút.</strong><p>Ôn lại từ vừa ghi để nhớ lâu hơn.</p><button onClick={() => go("review")}>Bắt đầu ôn <ChevronRight size={15} aria-hidden="true" /></button></div>
      <div className="account"><span className="account-avatar">{email.charAt(0).toUpperCase()}</span><div><strong>Tài khoản của tôi</strong><small title={email}>{email}</small></div><Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /></Button></div>
    </aside>
    <main id="main-content" className="main-content"><div className="page-wrap">
      <header className="page-header"><div className="mobile-brand"><span className="brand-mark">N</span><strong>NoteIelts</strong></div><div className="header-date"><CalendarDays size={16} aria-hidden="true" /> {displayDate(today)}</div><Button className="add-button" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" /> Thêm từ</Button></header>
      {notice && <div className="notice" role="status"><CheckCircle2 size={17} aria-hidden="true" /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Đóng thông báo"><Trash2 size={15} aria-hidden="true" /></button></div>}
      {backupDue && <div className="backup-banner"><CloudDownload size={20} aria-hidden="true" /><div><strong>Đã đến lúc lưu bản sao</strong><span>Xuất bản sao dữ liệu để giữ từ vựng của bạn an toàn lâu dài.</span></div><Button variant="outline" onClick={() => go("settings")}>Sao lưu ngay</Button></div>}
      {view === "today" && <><div className="page-heading"><div><span className="eyebrow">SỔ TỪ CỦA BẠN</span><h1>Chào bạn, hôm nay học gì?</h1><p>Ghi lại từ mới và tiến bộ theo nhịp của riêng bạn.</p></div></div>
        <div className="stat-grid"><div className="stat-card"><span className="stat-label">Từ đã ghi</span><strong>{active.length}</strong><span className="stat-caption">Trong sổ từ của bạn</span><BookOpenText aria-hidden="true" /></div><div className="stat-card"><span className="stat-label">Từ hôm nay</span><strong>{todayEntries.length}</strong><span className="stat-caption">Ngày {displayDate(today)}</span><CalendarDays aria-hidden="true" /></div><div className="stat-card"><span className="stat-label">Đã nhớ</span><strong>{remembered}</strong><span className="stat-caption">Qua những lần ôn tập</span><CheckCircle2 aria-hidden="true" /></div></div>
        <div className="content-grid"><section className="content-card"><div className="card-heading"><div><span className="section-kicker">HÔM NAY</span><h2>Từ mới của bạn</h2></div><button className="text-link" onClick={() => go("words")}>Xem sổ từ <ChevronRight size={16} aria-hidden="true" /></button></div>{todayEntries.length ? wordRows(todayEntries.slice(0, 6)) : <div className="empty-state"><span className="empty-icon"><BookOpenText aria-hidden="true" /></span><h3>Trang hôm nay còn trống</h3><p>Thêm từ đầu tiên để bắt đầu một ngày học mới.</p><Button onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" /> Thêm từ đầu tiên</Button></div>}</section>
          <aside className="right-column"><div className="review-promo"><span className="promo-overline">FLASHCARD CỦA BẠN</span><Layers3 size={27} aria-hidden="true" /><h2>Học lại theo ngày</h2><p>Chọn một ngày, lật thẻ và xem bạn nhớ được bao nhiêu từ.</p><Button onClick={() => go("review")}>Bắt đầu ôn tập <ChevronRight size={17} aria-hidden="true" /></Button></div><div className="mini-card"><span className="section-kicker">NHỊP HỌC CỦA BẠN</span><strong>{uniqueDays} ngày</strong><p>đã có từ mới trong sổ. Mỗi lần ghi lại đều đáng giá.</p></div></aside></div></>}
      {view === "words" && <><div className="page-heading"><div><span className="eyebrow">THƯ VIỆN TỪ VỰNG</span><h1>Sổ từ của bạn</h1><p>Mọi từ được sắp theo ngày bạn ghi lại.</p></div><span className="heading-count">{active.length} từ đã lưu</span></div><div className="toolbar"><label className="search-box"><Search size={18} aria-hidden="true" /><span className="sr-only">Tìm từ</span><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm từ hoặc nghĩa..." /></label><label className="filter-label">Loại từ <select className="native-select" value={pos} onChange={(e) => setPos(e.target.value)}><option value="all">Tất cả</option>{posOptions.map((value) => <option key={value}>{value}</option>)}</select></label><Button variant={trash ? "secondary" : "outline"} className="h-11" onClick={() => setTrash(!trash)}><Trash2 size={17} aria-hidden="true" /> {trash ? "Xem sổ từ" : "Thùng rác"}</Button></div>
        {groups.length ? groups.map((date) => <section className="content-card word-group" key={date}><div className="card-heading"><div><span className="section-kicker">NGÀY GHI TỪ</span><h2>{displayDate(date)}</h2></div><span className="group-count">{filtered.filter((item) => item.added_date === date).length} từ</span></div>{wordRows(filtered.filter((item) => item.added_date === date))}</section>) : <div className="content-card empty-state"><span className="empty-icon"><BookOpenText aria-hidden="true" /></span><h3>{trash ? "Thùng rác trống" : "Chưa tìm thấy từ"}</h3><p>{trash ? "Các từ bạn chuyển vào thùng rác sẽ xuất hiện tại đây." : "Thử bộ lọc khác hoặc thêm một từ mới."}</p></div>}</>}
      {view === "review" && <Review entries={active} timezone={profile.timezone} onReviewed={() => router.refresh()} />}
      {view === "settings" && <Settings entries={entries} profile={profile} email={email} onImported={() => router.refresh()} onExported={() => router.refresh()} />}
    </div></main>
    <nav className="mobile-nav" aria-label="Điều hướng chính">{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => go(item.id)} aria-current={view === item.id ? "page" : undefined}><item.icon size={21} aria-hidden="true" /><span>{item.label}</span></button>)}</nav>
    {(adding || editing) && <WordForm key={editing?.id ?? "new"} existing={editing} timezone={profile.timezone} entries={entries} onClose={() => { setAdding(false); setEditingId(null); }} onSaved={saved} onFind={find} onConflict={() => router.refresh()} />}
  </div>;
}
