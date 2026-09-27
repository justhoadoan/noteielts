"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markStudyResults } from "@/app/actions";
import { choiceOptions, isCorrectAnswer, makeTestQuestions, shuffled, type StudyQuestion } from "@/lib/study";
import type { WordEntry } from "@/lib/model";

type ResultRow = { id: string; remembered: boolean };
type SessionProps = { entries: WordEntry[]; onExit: () => void; onReviewed: () => void };

function useStudySync(entries: WordEntry[], onReviewed: () => void) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "preview">("idle");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ResultRow[]>([]);

  async function save(rows: ResultRow[]) {
    setPending(rows);
    if (entries[0]?.user_id === "preview") { setStatus("preview"); return; }
    setStatus("saving");
    setError("");
    try {
      const result = await markStudyResults(rows);
      if (!result.ok) { setStatus("error"); setError(result.error); return; }
      setStatus("saved");
      onReviewed();
    } catch {
      setStatus("error");
      setError("Không thể đồng bộ kết quả. Hãy thử lại.");
    }
  }

  return { status, error, save, retry: () => void save(pending), reset: () => { setStatus("idle"); setError(""); setPending([]); } };
}

function SyncNotice({ status, error, onRetry }: { status: "idle" | "saving" | "saved" | "error" | "preview"; error: string; onRetry: () => void }) {
  if (status === "idle") return null;
  return <div className={status === "error" ? "study-sync study-sync-error" : "study-sync"} role="status">
    <span>{status === "saving" ? "Đang đồng bộ kết quả…" : status === "saved" ? "Kết quả đã đồng bộ với tài khoản của bạn." : status === "preview" ? "Đây là bản xem thử; kết quả không được lưu." : error}</span>
    {status === "error" && <Button variant="outline" className="h-11" onClick={onRetry}>Thử lại</Button>}
  </div>;
}

function QuestionPrompt({ question, prompt }: { question: StudyQuestion; prompt: string }) {
  return <div className="study-prompt"><span className="section-kicker">{question.kind === "choice" ? "CHỌN ĐÁP ÁN" : "GÕ ĐÁP ÁN"}</span><p>{prompt}</p><blockquote lang="en">{question.entry.definition}</blockquote><span className="study-pos">{question.entry.part_of_speech}</span></div>;
}

function Progress({ current, total, label }: { current: number; total: number; label: string }) {
  return <div className="study-progress"><span>{label}: {current}/{total}</span><div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${(current / total) * 100}%` }} /></div></div>;
}

function initialLearnTasks(entries: WordEntry[]) {
  return shuffled(entries).map((entry) => {
    const options = choiceOptions(entry, entries);
    return { entry, kind: options.length > 1 ? "choice" : "write", options } satisfies StudyQuestion;
  });
}

export function LearnSession({ entries, onExit, onReviewed }: SessionProps) {
  const [activeEntries, setActiveEntries] = useState(entries);
  const [tasks, setTasks] = useState<StudyQuestion[]>(() => initialLearnTasks(entries));
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const sync = useStudySync(entries, onReviewed);
  const current = tasks[0];

  function submit(answer: string) {
    if (!current || feedback || !answer.trim()) return;
    const correct = isCorrectAnswer(answer, current.entry.word);
    if (!correct) setMissed((value) => value.includes(current.entry.id) ? value : [...value, current.entry.id]);
    setFeedback({ correct, answer });
  }

  function next() {
    if (!current || !feedback) return;
    const remaining = tasks.slice(1);
    if (current.kind === "choice") {
      remaining.push({ ...current, kind: feedback.correct ? "write" : "choice" });
    } else if (!feedback.correct) {
      remaining.push(current);
    } else {
      setMastered((value) => [...value, current.entry.id]);
    }
    setFeedback(null);
    setTyped("");
    setTasks(remaining);
    if (!remaining.length) {
      setFinished(true);
      void sync.save(activeEntries.map((entry) => ({ id: entry.id, remembered: !missed.includes(entry.id) })));
    }
  }

  function restart(items: WordEntry[]) {
    setActiveEntries(items);
    setTasks(initialLearnTasks(items));
    setTyped("");
    setFeedback(null);
    setMastered([]);
    setMissed([]);
    setFinished(false);
    sync.reset();
  }

  if (finished) {
    const missedEntries = activeEntries.filter((entry) => missed.includes(entry.id));
    return <div className="study-area"><div className="study-summary content-card"><div className="finish-icon"><Check size={28} aria-hidden="true" /></div><span className="section-kicker">HOÀN THÀNH LUYỆN TẬP</span><h2>Bạn đã trả lời đúng cả {activeEntries.length} từ</h2><p>{missed.length ? `${missed.length} từ từng trả lời sai sẽ được gợi ý ôn thêm.` : "Bạn trả lời đúng ngay từ lần đầu với tất cả các từ."}</p><SyncNotice status={sync.status} error={sync.error} onRetry={sync.retry} /><div className="finish-actions">{missedEntries.length > 0 && <Button className="h-11" onClick={() => restart(missedEntries)}><RotateCcw size={17} aria-hidden="true" /> Luyện lại từ sai</Button>}<Button variant="outline" className="h-11" onClick={() => restart(entries)}>Luyện lại tất cả</Button><Button variant="ghost" className="h-11" onClick={onExit}>Chọn chế độ khác</Button></div></div></div>;
  }

  return <div className="study-area"><div className="study-topline"><Button variant="ghost" className="h-11" onClick={onExit}><ArrowLeft size={17} aria-hidden="true" /> Đổi chế độ/ngày</Button><span>Luyện đến khi nhớ hết</span></div><Progress current={mastered.length} total={activeEntries.length} label="Từ đã thuộc" />
    <div className="study-question content-card">
      <QuestionPrompt question={current} prompt={current.kind === "choice" ? "Từ nào có nghĩa này?" : "Gõ từ tiếng Anh theo nghĩa dưới đây"} />
      {current.kind === "choice" ? <div className="study-options" role="group" aria-label="Các đáp án">{current.options.map((option) => <button key={option} type="button" className={`study-option${feedback && isCorrectAnswer(option, current.entry.word) ? " correct" : ""}${feedback && feedback.answer === option && !feedback.correct ? " incorrect" : ""}`} disabled={Boolean(feedback)} onClick={() => submit(option)}>{option}{feedback && isCorrectAnswer(option, current.entry.word) && <Check size={18} aria-hidden="true" />}</button>)}</div> :
        <form className="study-write" onSubmit={(event) => { event.preventDefault(); submit(typed); }}><label htmlFor="learn-answer">Câu trả lời của bạn</label><div><Input id="learn-answer" value={typed} onChange={(event) => setTyped(event.target.value)} disabled={Boolean(feedback)} autoComplete="off" spellCheck={false} className="h-12" /><Button type="submit" className="h-12" disabled={Boolean(feedback) || !typed.trim()}>Kiểm tra</Button></div></form>}
      {feedback && <div className={feedback.correct ? "study-feedback correct" : "study-feedback incorrect"} role="status"><strong>{feedback.correct ? "Chính xác!" : "Chưa đúng, từ này sẽ xuất hiện lại."}</strong><span>Đáp án: <b lang="en">{current.entry.word}</b>{current.entry.example ? ` · ${current.entry.example}` : ""}</span><Button className="h-11" onClick={next}>{tasks.length === 1 && current.kind === "write" && feedback.correct ? "Xem kết quả" : "Tiếp tục"} <ArrowRight size={17} aria-hidden="true" /></Button></div>}
    </div>
  </div>;
}

export function TestSession({ entries, onExit, onReviewed }: SessionProps) {
  const [questions, setQuestions] = useState<StudyQuestion[]>(() => makeTestQuestions(entries));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const sync = useStudySync(entries, onReviewed);
  const current = questions[index];
  const answered = questions.filter((question) => Boolean(answers[question.entry.id]?.trim())).length;
  const correct = questions.filter((question) => isCorrectAnswer(answers[question.entry.id] ?? "", question.entry.word));

  function submit() {
    if (answered !== questions.length) return;
    setSubmitted(true);
    void sync.save(questions.map((question) => ({
      id: question.entry.id,
      remembered: isCorrectAnswer(answers[question.entry.id] ?? "", question.entry.word),
    })));
  }

  function restart(items: WordEntry[]) {
    setQuestions(makeTestQuestions(items));
    setAnswers({});
    setIndex(0);
    setSubmitted(false);
    sync.reset();
  }

  if (submitted) {
    const wrong = questions.filter((question) => !isCorrectAnswer(answers[question.entry.id] ?? "", question.entry.word));
    return <div className="study-area"><div className="study-summary content-card"><div className="finish-icon"><ClipboardCheck size={28} aria-hidden="true" /></div><span className="section-kicker">KẾT QUẢ KIỂM TRA</span><h2>{correct.length}/{questions.length} câu đúng</h2><p>{Math.round(correct.length / questions.length * 100)}% chính xác · Xem lại đáp án bên dưới.</p><SyncNotice status={sync.status} error={sync.error} onRetry={sync.retry} /><div className="finish-actions">{wrong.length > 0 && <Button className="h-11" onClick={() => restart(wrong.map((question) => question.entry))}><RotateCcw size={17} aria-hidden="true" /> Làm lại câu sai</Button>}<Button variant="outline" className="h-11" onClick={() => restart(entries)}>Làm bài mới</Button><Button variant="ghost" className="h-11" onClick={onExit}>Chọn chế độ khác</Button></div></div>
      <div className="study-results">{questions.map((question, position) => { const answer = answers[question.entry.id]; const passed = isCorrectAnswer(answer ?? "", question.entry.word); return <article key={question.entry.id} className={passed ? "study-result correct" : "study-result incorrect"}><span>Câu {position + 1} · {passed ? "Đúng" : "Sai"}</span><h3 lang="en">{question.entry.definition}</h3><p>Bạn trả lời: <strong>{answer}</strong></p>{!passed && <p>Đáp án đúng: <strong>{question.entry.word}</strong></p>}</article>; })}</div>
    </div>;
  }

  return <div className="study-area"><div className="study-topline"><Button variant="ghost" className="h-11" onClick={onExit}><ArrowLeft size={17} aria-hidden="true" /> Đổi chế độ/ngày</Button><span>Chưa hiển thị đáp án trước khi nộp</span></div><Progress current={answered} total={questions.length} label="Câu đã trả lời" />
    <div className="study-question content-card">
      <div className="study-question-number">CÂU {index + 1} / {questions.length}</div>
      <QuestionPrompt question={current} prompt={current.kind === "choice" ? "Chọn từ phù hợp với nghĩa" : "Viết từ phù hợp với nghĩa"} />
      {current.kind === "choice" ? <div className="study-options" role="group" aria-label="Các đáp án">{current.options.map((option) => <button key={option} type="button" className={answers[current.entry.id] === option ? "study-option selected" : "study-option"} aria-pressed={answers[current.entry.id] === option} onClick={() => setAnswers((value) => ({ ...value, [current.entry.id]: option }))}>{option}</button>)}</div> :
        <div className="study-write"><label htmlFor="test-answer">Câu trả lời của bạn</label><Input id="test-answer" key={current.entry.id} value={answers[current.entry.id] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [current.entry.id]: event.target.value }))} autoComplete="off" spellCheck={false} className="h-12" /></div>}
    </div>
    <div className="study-navigation"><Button variant="outline" className="h-11" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={17} aria-hidden="true" /> Câu trước</Button>{index < questions.length - 1 ? <Button className="h-11" onClick={() => setIndex(index + 1)}>Câu tiếp <ArrowRight size={17} aria-hidden="true" /></Button> : <Button className="h-11" disabled={answered !== questions.length} onClick={submit}><ClipboardCheck size={17} aria-hidden="true" /> Nộp bài</Button>}</div>
    {index < questions.length - 1 && <div className="study-submit-row"><Button variant="ghost" className="h-11" disabled={answered !== questions.length} onClick={submit}>Nộp bài khi đã trả lời đủ</Button></div>}
  </div>;
}
