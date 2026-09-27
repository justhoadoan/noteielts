"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveWord } from "@/app/actions";
import { localDate, type WordEntry, type WordInput } from "@/lib/model";

type Definition = { part_of_speech: string; definition: string; example: string; usage_note?: string };
const POS = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "other"];

export function WordForm({ existing, timezone, entries, onClose, onSaved, onFind, onConflict }: {
  existing?: WordEntry; timezone: string; entries: WordEntry[];
  onClose: () => void; onSaved: (word: string) => void; onFind: (id: string) => void; onConflict: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);
  const suppressSuggestions = useRef(false);
  const draftKey = `noteielts-draft-${existing?.id ?? "new"}`;
  const [form, setForm] = useState<WordInput>(() => ({
    id: existing?.id ?? crypto.randomUUID(), word: existing?.word ?? "", part_of_speech: existing?.part_of_speech ?? "noun",
    definition: existing?.definition ?? "", example: existing?.example ?? "", note: existing?.note ?? "",
    added_date: existing?.added_date ?? localDate(timezone), source_name: existing?.source_name ?? "", source_url: existing?.source_url ?? "",
  }));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "missing">("idle");
  const [lookupError, setLookupError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem(draftKey);
      if (saved) { try { const draft = JSON.parse(saved) as WordInput; if (draft.id === form.id) setForm(draft); } catch { /* Ignore corrupt local draft. */ } }
      setDraftLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
    // Draft is read only on mount. Existing updates are handled by conflict controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (draftLoaded) localStorage.setItem(draftKey, JSON.stringify(form)); }, [form, draftKey, draftLoaded]);
  useEffect(() => {
    if (suppressSuggestions.current || form.word.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/suggestions?q=${encodeURIComponent(form.word.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setSuggestions(response.ok ? data.suggestions ?? [] : []);
      } catch { if (!controller.signal.aborted) setSuggestions([]); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.word]);

  function update<K extends keyof WordInput>(key: K, value: WordInput[K]) { setForm((current) => ({ ...current, [key]: value })); setError(""); }
  async function lookup(word: string) {
    const query = word.trim();
    if (!query) return;
    suppressSuggestions.current = true;
    const thisSeq = ++seq.current;
    setSuggestions([]); setActiveSuggestion(-1); setLookupState("loading"); setLookupError(""); setDefinitions([]);
    try {
      const response = await fetch(`/api/dictionary?word=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (thisSeq !== seq.current) return;
      if (!response.ok) { setLookupError(data.error ?? "Không thể tra từ."); setLookupState("missing"); return; }
      const items: Definition[] = data.definitions ?? [];
      setDefinitions(items);
      setLookupState(items.length ? "found" : "missing");
      if (!items.length) { setLookupError("Không tìm thấy từ. Bạn có thể tự điền nghĩa và ví dụ."); return; }
      const first = items[0];
      setForm((current) => ({ ...current, word: query, part_of_speech: first.part_of_speech,
        definition: first.definition, example: first.example, source_name: data.source_name ?? "Free Dictionary API", source_url: data.source_url ?? "" }));
    } catch {
      if (thisSeq === seq.current) { setLookupError("Không kết nối được từ điển. Bạn có thể tự điền nghĩa."); setLookupState("missing"); }
    }
  }
  function pickDefinition(item: Definition) {
    setForm((current) => ({ ...current, part_of_speech: item.part_of_speech, definition: item.definition, example: item.example }));
  }
  const duplicate = entries.find((item) => !item.deleted_at && item.id !== form.id &&
    item.word.trim().toLowerCase() === form.word.trim().toLowerCase() &&
    item.part_of_speech.trim().toLowerCase() === form.part_of_speech.trim().toLowerCase() &&
    item.definition.trim().toLowerCase() === form.definition.trim().toLowerCase());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (duplicate) { setError("Bạn đã lưu nghĩa này."); return; }
    setBusy(true); setError("");
    const result = await saveWord(form, existing?.version);
    setBusy(false);
    if (result.ok) { localStorage.removeItem(draftKey); onSaved(form.word); return; }
    setError(result.error);
    if (result.conflict) { setConflict(true); onConflict(); }
    if (result.duplicateId) onFind(result.duplicateId);
  }
  function useCurrent() {
    if (!existing) return;
    setForm({ id: existing.id, word: existing.word, part_of_speech: existing.part_of_speech,
      definition: existing.definition, example: existing.example, note: existing.note,
      added_date: existing.added_date, source_name: existing.source_name, source_url: existing.source_url });
    setConflict(false); setError("");
  }
  const availablePos = [...new Set([...POS, ...definitions.map((item) => item.part_of_speech)])];
  const visibleDefinitions = definitions.filter((item) => item.part_of_speech === form.part_of_speech);
  return <dialog ref={dialog} className="word-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="word-form-title">
    <form className="word-form" onSubmit={submit}>
      <div className="form-top"><Button type="button" variant="ghost" className="h-11" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" /> Quay lại</Button><span className="form-top-label">{existing ? "CHỈNH SỬA TỪ" : "THÊM TỪ MỚI"}</span><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Đóng" onClick={onClose}><X aria-hidden="true" /></Button></div>
      <div className="form-body"><h2 id="word-form-title">{existing ? "Chỉnh sửa từ vựng" : "Một từ mới hôm nay"}</h2><p className="form-subtitle">Ghi lại điều bạn muốn nhớ. Bạn có thể chỉnh sửa mọi thứ sau.</p>
        <div className="form-field"><label htmlFor="word-input">Từ tiếng Anh <span aria-hidden="true">*</span></label>
          <div className="word-input-row"><div className="suggestion-wrap"><Input id="word-input" autoFocus autoComplete="off" value={form.word}
            onChange={(event) => { seq.current++; suppressSuggestions.current = false; setDefinitions([]); setLookupState("idle"); update("word", event.target.value); setActiveSuggestion(-1); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1)); }
              if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActiveSuggestion((i) => Math.max(i - 1, 0)); }
              if (event.key === "Enter") { event.preventDefault(); const selected = suggestions[activeSuggestion] ?? form.word; update("word", selected); void lookup(selected); }
              if (event.key === "Escape") setSuggestions([]);
            }}
            role="combobox" aria-expanded={suggestions.length > 0} aria-controls="word-suggestions" aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined} placeholder="Ví dụ: serendipity" className="h-12" />
            {suggestions.length > 0 && <div className="suggestions" id="word-suggestions" role="listbox">{suggestions.map((suggestion, index) => <button type="button" role="option" id={`suggestion-${index}`} aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "active" : ""} key={suggestion} onClick={() => { update("word", suggestion); void lookup(suggestion); }}>{suggestion}</button>)}</div>}</div>
            <Button type="button" className="h-12 px-5" onClick={() => void lookup(form.word)} disabled={!form.word.trim() || lookupState === "loading"}>{lookupState === "loading" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />} Tra từ</Button></div>
          <p className="field-help">Chọn từ gợi ý hoặc nhấn Enter để tra nghĩa.</p></div>
        {lookupError && <p className="lookup-note" role="status">{lookupError}</p>}
        <div className="form-field"><label htmlFor="part-of-speech">Loại từ <span aria-hidden="true">*</span></label><select id="part-of-speech" value={form.part_of_speech} onChange={(e) => { const pos = e.target.value; update("part_of_speech", pos); const match = definitions.find((item) => item.part_of_speech === pos); if (match) pickDefinition(match); }} className="native-select">{availablePos.map((pos) => <option key={pos} value={pos}>{pos}</option>)}</select></div>
        {visibleDefinitions.length > 0 && <fieldset className="meaning-options"><legend>Chọn một nghĩa từ từ điển</legend>{visibleDefinitions.map((item, index) => <button key={`${item.definition}-${index}`} type="button" className={form.definition === item.definition ? "meaning-option selected" : "meaning-option"} onClick={() => pickDefinition(item)}><span className="meaning-radio">{form.definition === item.definition && <Check size={13} aria-hidden="true" />}</span><span>{item.definition}{item.usage_note && <small>{item.usage_note}</small>}{item.example && <small>{item.example}</small>}</span></button>)}</fieldset>}
        <div className="form-field"><label htmlFor="definition">Nghĩa tiếng Anh <span aria-hidden="true">*</span></label><Textarea id="definition" required maxLength={1000} value={form.definition} onChange={(e) => update("definition", e.target.value)} placeholder="Giải thích từ bằng tiếng Anh" className="min-h-24" /></div>
        <div className="form-field"><label htmlFor="example">Câu ví dụ</label><Textarea id="example" maxLength={1500} value={form.example} onChange={(e) => update("example", e.target.value)} placeholder="Một câu sử dụng từ này" className="min-h-20" /><p className="field-help">Từ điển không phải lúc nào cũng có câu ví dụ. Bạn có thể tự viết hoặc sửa.</p></div>
        <div className="form-grid"><div className="form-field"><label htmlFor="added-date">Ngày ghi từ</label><Input id="added-date" type="date" required value={form.added_date} onChange={(e) => update("added_date", e.target.value)} className="h-11" /></div><div className="form-field"><label htmlFor="note">Ghi chú riêng</label><Input id="note" maxLength={2000} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="Ví dụ: gặp trong bài đọc..." className="h-11" /></div></div>
        {duplicate && <p className="form-warning">Nghĩa này đã có trong sổ. <button type="button" onClick={() => onFind(duplicate.id)}>Xem mục đã lưu</button></p>}
        {conflict && <div className="conflict-box"><strong>Từ đã được sửa ở thiết bị khác.</strong><p>Bản nháp của bạn vẫn ở thiết bị này. Tải lại trang để lấy phiên bản mới, rồi chọn nội dung cần giữ.</p><Button type="button" variant="outline" onClick={useCurrent} disabled={!existing}>Dùng bản mới trên cloud</Button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><div className="form-footer"><span>Bản nháp lưu trên thiết bị này cho đến khi cloud xác nhận.</span><Button type="submit" className="h-11 px-6" disabled={busy || !form.word.trim() || !form.definition.trim() || Boolean(duplicate)}>{busy ? "Đang lưu…" : existing ? "Lưu thay đổi" : "Lưu từ vào sổ"}</Button></div>
    </form>
  </dialog>;
}
