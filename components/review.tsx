"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, Check, ClipboardCheck, Layers3, RotateCcw, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LearnSession, TestSession } from "@/components/study-session";
import { markReview } from "@/app/actions";
import { displayDate, localDate, type WordEntry } from "@/lib/model";
import { shuffled } from "@/lib/study";

type Mode = "flashcards" | "learn" | "test";

export function Review({ entries, timezone, onReviewed }: { entries: WordEntry[]; timezone: string; onReviewed: () => void }) {
  const today = localDate(timezone);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [testCount, setTestCount] = useState("10");
  const [sessionKey, setSessionKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = useMemo(() => entries.filter((entry) => entry.added_date >= start && entry.added_date <= end), [entries, start, end]);
  const current = mode === "flashcards" && !complete ? queue[index] : undefined;
  const reviewedCount = Object.keys(results).length;
  const missed = queue.filter((entry) => results[entry.id] === false);

  function begin(items: WordEntry[]) {
    const maxCount = mode === "test" ? (testCount === "all" ? 50 : Number(testCount)) : 50;
    setQueue(mode === "flashcards" ? items : shuffled(items).slice(0, maxCount));
    setSessionKey((value) => value + 1);
    setIndex(0);
    setResults({});
    setComplete(false);
    setRevealed(false);
    setError("");
  }

  function changeCard(nextIndex: number) {
    if (busy || nextIndex < 0 || nextIndex >= queue.length) return;
    setIndex(nextIndex);
    setRevealed(false);
    setError("");
  }

  function shuffle() {
    setQueue((items) => {
      const result = [...items];
      for (let i = result.length - 1; i > index + 1; i--) {
        const j = index + 1 + Math.floor(Math.random() * (i - index));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    });
  }

  async function answer(remembered: boolean) {
    if (!current || busy) return;
    setBusy(true);
    setError("");
    let result: Awaited<ReturnType<typeof markReview>>;
    try {
      result = await markReview(current.id, remembered);
    } catch {
      setError("Không thể lưu kết quả ôn tập. Vui lòng thử lại.");
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) { setError(result.error); return; }

    const updated = { ...results, [current.id]: remembered };
    setResults(updated);
    onReviewed();
    const next = queue.findIndex((entry, position) => position > index && updated[entry.id] === undefined);
    const firstUnanswered = next < 0 ? queue.findIndex((entry) => updated[entry.id] === undefined) : next;
    if (firstUnanswered < 0) {
      setComplete(true);
    } else {
      changeCard(firstUnanswered);
    }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">HỌC THEO NHỊP CỦA BẠN</span><h1>{mode === "flashcards" ? "Ôn tập flashcard" : mode === "learn" ? "Luyện từ vựng" : "Kiểm tra từ vựng"}</h1><p>Chọn cách học phù hợp với bạn hôm nay.</p></div></div>
    {!queue.length && <div className="review-setup content-card"><div className="setup-icon"><Layers3 size={27} aria-hidden="true" /></div><h2>Chọn cách học</h2><p>Học từ đã lưu theo ngày hoặc khoảng ngày.</p>
      <div className="review-mode-picker" role="group" aria-label="Chế độ học">
        <button type="button" aria-pressed={mode === "flashcards"} className={mode === "flashcards" ? "study-mode selected" : "study-mode"} onClick={() => setMode("flashcards")}><Layers3 size={22} aria-hidden="true" /><strong>Flashcard</strong><span>Lật thẻ và tự đánh giá.</span></button>
        <button type="button" aria-pressed={mode === "learn"} className={mode === "learn" ? "study-mode selected" : "study-mode"} onClick={() => setMode("learn")}><BookOpenCheck size={22} aria-hidden="true" /><strong>Luyện</strong><span>Chọn, gõ và luyện lại từ sai.</span></button>
        <button type="button" aria-pressed={mode === "test"} className={mode === "test" ? "study-mode selected" : "study-mode"} onClick={() => setMode("test")}><ClipboardCheck size={22} aria-hidden="true" /><strong>Kiểm tra</strong><span>Làm bài rồi xem điểm và đáp án.</span></button>
      </div>
      <div className="date-range"><label>Từ ngày<Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11" /></label><span aria-hidden="true">→</span><label>Đến ngày<Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-11" /></label></div>
      {mode === "test" && <label className="study-count-label">Số câu hỏi<select className="native-select" value={testCount} onChange={(event) => setTestCount(event.target.value)}><option value="5">Tối đa 5 câu</option><option value="10">Tối đa 10 câu</option><option value="20">Tối đa 20 câu</option><option value="all">Tất cả (tối đa 50)</option></select></label>}
      {mode !== "flashcards" && <p className="study-limit">Mỗi phiên {mode === "learn" ? "luyện" : "kiểm tra"} dùng tối đa 50 từ. Kết quả được đồng bộ sau khi hoàn thành.</p>}
      <div className="review-setup-footer"><span><CalendarDays size={17} aria-hidden="true" /> {start <= end ? matches.length : 0} từ trong khoảng đã chọn</span><Button className="h-11 px-5" disabled={!matches.length || start > end} onClick={() => begin(matches)}>{!matches.length ? "Chưa có từ" : mode === "flashcards" ? "Bắt đầu học" : mode === "learn" ? "Bắt đầu luyện" : "Bắt đầu kiểm tra"}<ArrowRight size={17} aria-hidden="true" /></Button></div>
    </div>}
    {queue.length > 0 && mode === "learn" && <LearnSession key={sessionKey} entries={queue} onExit={() => setQueue([])} onReviewed={onReviewed} />}
    {queue.length > 0 && mode === "test" && <TestSession key={sessionKey} entries={queue} onExit={() => setQueue([])} onReviewed={onReviewed} />}
    {current && <div className="review-area">
      <div className="review-toolbar"><Button variant="ghost" className="h-11" disabled={busy} onClick={() => setQueue([])}><ArrowLeft size={17} aria-hidden="true" /> Đổi ngày</Button><span>Thẻ {index + 1} / {queue.length} · Đã đánh giá {reviewedCount}/{queue.length}</span><Button variant="outline" className="h-11" disabled={busy} onClick={shuffle}><Shuffle size={17} aria-hidden="true" /> Đảo thứ tự</Button></div>
      <div className="progress-track" role="progressbar" aria-label="Tiến độ ôn tập" aria-valuenow={reviewedCount} aria-valuemin={0} aria-valuemax={queue.length}><span style={{ width: `${(reviewedCount / queue.length) * 100}%` }} /></div>
      <button key={current.id} type="button" className="flashcard" data-revealed={revealed} onClick={() => setRevealed((value) => !value)} aria-label={revealed ? "Ẩn nghĩa của từ" : "Lật thẻ để xem nghĩa"} aria-pressed={revealed}>
        <span className="flashcard-inner">
          <span className="flashcard-face flashcard-front" aria-hidden={revealed}>
            <span className="flashcard-kicker">MẶT TRƯỚC · TỪ VỰNG</span><strong>{current.word}</strong><span className="flashcard-pos">{current.part_of_speech}</span><span className="flashcard-hint"><RotateCcw size={15} aria-hidden="true" /> Nhấn để lật thẻ</span>
          </span>
          <span className="flashcard-face flashcard-back" aria-hidden={!revealed}>
            <span className="flashcard-kicker">MẶT SAU · NGHĨA CỦA TỪ</span><strong className="flashcard-meaning">{current.definition}</strong><span className="flashcard-example">{current.example || "Chưa có câu ví dụ."}</span>{current.note && <small>Ghi chú: {current.note}</small>}<span className="flashcard-hint"><RotateCcw size={15} aria-hidden="true" /> Nhấn để xem từ</span>
          </span>
        </span>
      </button>
      <div className="review-navigation"><Button variant="outline" className="h-11" disabled={index === 0 || busy} onClick={() => changeCard(index - 1)}><ArrowLeft size={17} aria-hidden="true" /> Thẻ trước</Button><span aria-live="polite">{results[current.id] === undefined ? "Chưa đánh giá" : results[current.id] ? "Đã nhớ" : "Chưa nhớ"}</span><Button variant="outline" className="h-11" disabled={index === queue.length - 1 || busy} onClick={() => changeCard(index + 1)}>Thẻ tiếp <ArrowRight size={17} aria-hidden="true" /></Button></div>
      <div className="review-actions"><Button variant="outline" className="h-12" disabled={!revealed || busy} onClick={() => void answer(false)}><X size={18} aria-hidden="true" /> Chưa nhớ</Button><Button className="h-12" disabled={!revealed || busy} onClick={() => void answer(true)}><Check size={18} aria-hidden="true" /> Đã nhớ</Button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>}
    {complete && <div className="review-finish content-card"><div className="finish-icon"><Check size={28} aria-hidden="true" /></div><span className="section-kicker">HOÀN THÀNH PHIÊN HỌC</span><h2>Bạn đã ôn {queue.length} từ!</h2><p>Đã nhớ <strong>{Object.values(results).filter(Boolean).length}</strong> từ · Cần ôn thêm <strong>{missed.length}</strong> từ</p><div className="finish-actions">{missed.length > 0 && <Button className="h-11" onClick={() => begin(missed)}><RotateCcw size={17} aria-hidden="true" /> Ôn từ chưa nhớ</Button>}<Button variant="outline" className="h-11" onClick={() => setQueue([])}>Chọn ngày khác</Button></div><small>{displayDate(start)}{end !== start ? ` – ${displayDate(end)}` : ""}</small></div>}
  </>;
}
