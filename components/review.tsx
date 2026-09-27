"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Layers3, RotateCcw, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markReview } from "@/app/actions";
import { displayDate, localDate, type WordEntry } from "@/lib/model";

export function Review({ entries, timezone, onReviewed }: { entries: WordEntry[]; timezone: string; onReviewed: () => void }) {
  const today = localDate(timezone);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; remembered: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = useMemo(() => entries.filter((entry) => entry.added_date >= start && entry.added_date <= end), [entries, start, end]);
  const current = queue[index];
  const complete = queue.length > 0 && index >= queue.length;
  function begin(items: WordEntry[]) { setQueue(items); setIndex(0); setResults([]); setRevealed(false); setError(""); }
  function shuffle() { setQueue((items) => { const result = [...items]; for (let i = result.length - 1; i > index + 1; i--) { const j = index + 1 + Math.floor(Math.random() * (i - index)); [result[i], result[j]] = [result[j], result[i]]; } return result; }); }
  async function answer(remembered: boolean) {
    if (!current) return;
    setBusy(true); setError("");
    const result = await markReview(current.id, remembered);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setResults((value) => [...value, { id: current.id, remembered }]);
    setIndex((value) => value + 1); setRevealed(false); onReviewed();
  }
  const missed = queue.filter((entry) => results.some((result) => result.id === entry.id && !result.remembered));
  return <><div className="page-heading"><div><span className="eyebrow">HỌC THEO NHỊP CỦA BẠN</span><h1>Ôn tập flashcard</h1><p>Mỗi tấm thẻ là một lần nhớ từ sâu hơn.</p></div></div>
    {!queue.length && <div className="review-setup content-card"><div className="setup-icon"><Layers3 size={27} aria-hidden="true" /></div><h2>Chọn ngày để bắt đầu</h2><p>Ôn từ của một ngày hoặc cả một khoảng thời gian.</p><div className="date-range"><label>Từ ngày<Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" /></label><span aria-hidden="true">→</span><label>Đến ngày<Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-11" /></label></div><div className="review-setup-footer"><span><CalendarDays size={17} aria-hidden="true" /> {start <= end ? matches.length : 0} từ trong khoảng đã chọn</span><Button className="h-11 px-5" disabled={!matches.length || start > end} onClick={() => begin(matches)}>{matches.length ? "Bắt đầu học" : "Chưa có từ"}<ArrowRight size={17} aria-hidden="true" /></Button></div></div>}
    {current && <div className="review-area"><div className="review-toolbar"><Button variant="ghost" className="h-11" onClick={() => setQueue([])}><ArrowLeft size={17} aria-hidden="true" /> Đổi ngày</Button><span>Thẻ {index + 1} / {queue.length}</span><Button variant="outline" className="h-11" onClick={shuffle}><Shuffle size={17} aria-hidden="true" /> Đảo thứ tự</Button></div><div className="progress-track" role="progressbar" aria-label="Tiến độ ôn tập" aria-valuenow={index} aria-valuemin={0} aria-valuemax={queue.length}><span style={{ width: `${(index / queue.length) * 100}%` }} /></div><button className="flashcard" onClick={() => setRevealed(!revealed)} aria-label={revealed ? "Ẩn nghĩa của từ" : "Lật thẻ để xem nghĩa"}><span className="flashcard-kicker">{revealed ? "MẶT SAU · NGHĨA CỦA TỪ" : "MẶT TRƯỚC · TỪ VỰNG"}</span>{revealed ? <><strong className="flashcard-meaning">{current.definition}</strong><p>{current.example || "Chưa có câu ví dụ."}</p>{current.note && <small>Ghi chú: {current.note}</small>}</> : <><strong>{current.word}</strong><span className="flashcard-pos">{current.part_of_speech}</span></>}<span className="flashcard-hint"><RotateCcw size={15} aria-hidden="true" /> Nhấn để {revealed ? "xem từ" : "lật thẻ"}</span></button><div className="review-actions"><Button variant="outline" className="h-12" disabled={!revealed || busy} onClick={() => void answer(false)}><X size={18} aria-hidden="true" /> Chưa nhớ</Button><Button className="h-12" disabled={!revealed || busy} onClick={() => void answer(true)}><Check size={18} aria-hidden="true" /> Đã nhớ</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</div>}
    {complete && <div className="review-finish content-card"><div className="finish-icon"><Check size={28} aria-hidden="true" /></div><span className="section-kicker">HOÀN THÀNH PHIÊN HỌC</span><h2>Bạn đã ôn {queue.length} từ!</h2><p>Đã nhớ <strong>{results.filter((result) => result.remembered).length}</strong> từ · Cần ôn thêm <strong>{missed.length}</strong> từ</p><div className="finish-actions">{missed.length > 0 && <Button className="h-11" onClick={() => begin(missed)}><RotateCcw size={17} aria-hidden="true" /> Ôn từ chưa nhớ</Button>}<Button variant="outline" className="h-11" onClick={() => setQueue([])}>Chọn ngày khác</Button></div><small>{displayDate(start)}{end !== start ? ` – ${displayDate(end)}` : ""}</small></div>}
  </>;
}
