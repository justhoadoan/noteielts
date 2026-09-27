"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { backupSchema, type Backup, type WordEntry, type WordInput, wordSchema } from "@/lib/model";

type ActionResult = { ok: true; id?: string; count?: number } | { ok: false; error: string; conflict?: boolean; duplicateId?: string };

async function authorized() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
  return { supabase, user };
}

function message(error: unknown) { return error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại."; }

async function findDuplicate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, input: WordInput, excludeId?: string) {
  const { data } = await supabase.from("word_entries").select("id,word,part_of_speech,definition")
    .eq("user_id", userId).is("deleted_at", null);
  return data?.find((row) => row.id !== excludeId &&
    row.word.trim().toLocaleLowerCase() === input.word.toLocaleLowerCase() &&
    row.part_of_speech.trim().toLocaleLowerCase() === input.part_of_speech.toLocaleLowerCase() &&
    row.definition.trim().toLocaleLowerCase() === input.definition.toLocaleLowerCase());
}

export async function saveWord(raw: unknown, expectedVersion?: number): Promise<ActionResult> {
  try {
    const input = wordSchema.parse(raw);
    const { supabase, user } = await authorized();
    const duplicate = await findDuplicate(supabase, user.id, input, expectedVersion ? input.id : undefined);
    if (duplicate) return { ok: false, error: "Bạn đã lưu từ, loại từ và nghĩa này.", duplicateId: duplicate.id };
    if (expectedVersion !== undefined) {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false, error: "Phiên bản không hợp lệ." };
      const { data, error } = await supabase.from("word_entries")
        .update({ ...input, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq("id", input.id).eq("user_id", user.id).eq("version", expectedVersion).is("deleted_at", null)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, error: "Từ này đã thay đổi ở thiết bị khác. Bản nháp được giữ lại; tải lại để xem bản mới.", conflict: true };
    } else {
      const { data: existing } = await supabase.from("word_entries").select("*").eq("id", input.id).eq("user_id", user.id).maybeSingle();
      if (existing) {
        const same = Object.entries(input).every(([field, value]) => existing[field] === value);
        return same ? { ok: true, id: input.id } : { ok: false, error: "Bản nháp khác dữ liệu đã lưu. Hãy tải lại mục từ để kiểm tra.", conflict: true };
      }
      const { error } = await supabase.from("word_entries").insert({ ...input, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          const repeat = await findDuplicate(supabase, user.id, input);
          return { ok: false, error: "Mục từ đã tồn tại.", duplicateId: repeat?.id };
        }
        throw error;
      }
    }
    revalidatePath("/");
    return { ok: true, id: input.id };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function setDeleted(id: string, version: number, restore: boolean): Promise<ActionResult> {
  try {
    if (!wordSchema.shape.id.safeParse(id).success || !Number.isSafeInteger(version) || version < 1) throw new Error("Dữ liệu không hợp lệ.");
    const { supabase, user } = await authorized();
    let query = supabase.from("word_entries")
      .update({ deleted_at: restore ? null : new Date().toISOString(), version: version + 1, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("version", version);
    query = restore ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    const { data, error } = await query.select("id").maybeSingle();
    if (error?.code === "23505") return { ok: false, error: "Đã có mục từ tương tự; không thể khôi phục." };
    if (error) throw error;
    if (!data) return { ok: false, error: "Mục từ đã thay đổi ở thiết bị khác. Hãy tải lại.", conflict: true };
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function markReview(id: string, remembered: boolean): Promise<ActionResult> {
  try {
    if (!wordSchema.shape.id.safeParse(id).success || typeof remembered !== "boolean") throw new Error("Dữ liệu không hợp lệ.");
    const { supabase, user } = await authorized();
    const { data: owned } = await supabase.from("word_entries").select("id").eq("id", id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (!owned) return { ok: false, error: "Không tìm thấy từ để ôn." };
    const { error } = await supabase.from("review_states").upsert({ user_id: user.id, entry_id: id, remembered, last_reviewed_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function markStudyResults(raw: unknown): Promise<ActionResult> {
  try {
    const rows = z.array(z.object({ id: z.uuid(), remembered: z.boolean() })).min(1).max(50).parse(raw);
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Danh sách từ ôn tập không hợp lệ.");
    const { supabase, user } = await authorized();
    const { data: owned, error: ownedError } = await supabase.from("word_entries").select("id")
      .eq("user_id", user.id).is("deleted_at", null).in("id", rows.map((row) => row.id));
    if (ownedError) throw ownedError;
    if (owned?.length !== rows.length) return { ok: false, error: "Một số từ đã bị xóa hoặc không thuộc tài khoản của bạn. Hãy tải lại sổ từ." };
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase.from("review_states").upsert(rows.map((row) => ({
      user_id: user.id, entry_id: row.id, remembered: row.remembered, last_reviewed_at: reviewedAt,
    })));
    if (error) throw error;
    revalidatePath("/");
    return { ok: true, count: rows.length };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function getAllEntries(): Promise<WordEntry[]> {
  const { supabase, user } = await authorized();
  const entries: WordEntry[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("word_entries").select("*").eq("user_id", user.id)
      .order("added_date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    entries.push(...(data as WordEntry[]));
    if (!data || data.length < 500) break;
  }
  const states: Array<{ entry_id: string; user_id: string; remembered: boolean; last_reviewed_at: string }> = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("review_states").select("*").eq("user_id", user.id).order("entry_id").range(start, start + 499);
    if (error) throw error;
    states.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const stateMap = new Map(states.map((state) => [state.entry_id, state]));
  return entries.map((entry) => ({ ...entry, review_state: stateMap.get(entry.id) ?? null }));
}

export async function exportBackup(): Promise<Backup> {
  const entries = await getAllEntries();
  const backup: Backup = {
    format: "noteielts-v1", exported_at: new Date().toISOString(),
    entries: entries.map((entry) => ({
      id: entry.id, word: entry.word, part_of_speech: entry.part_of_speech,
      definition: entry.definition, example: entry.example, note: entry.note,
      added_date: entry.added_date, source_name: entry.source_name, source_url: entry.source_url,
      deleted_at: entry.deleted_at,
      review_state: entry.review_state ? { remembered: entry.review_state.remembered, last_reviewed_at: entry.review_state.last_reviewed_at } : null,
    })),
  };
  return backup;
}

export async function recordExport(): Promise<ActionResult> {
  try {
    const { supabase, user } = await authorized();
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, last_export_at: new Date().toISOString() });
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function importBackup(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = backupSchema.parse(raw);
    if (JSON.stringify(parsed).length > 1_500_000) throw new Error("Bản sao lưu quá lớn.");
    const { supabase, user } = await authorized();
    const existing = await getAllEntries();
    const knownIds = new Set(existing.map((entry) => entry.id));
    const knownActive = new Set(existing.filter((entry) => !entry.deleted_at).map((entry) => key(entry)));
    const pending: typeof parsed.entries = [];
    for (const entry of parsed.entries) {
      if (knownIds.has(entry.id) || (!entry.deleted_at && knownActive.has(key(entry)))) continue;
      knownIds.add(entry.id);
      if (!entry.deleted_at) knownActive.add(key(entry));
      pending.push(entry);
    }
    let count = 0;
    for (let start = 0; start < pending.length; start += 100) {
      const batch = pending.slice(start, start + 100);
      const rows = batch.map((entry) => ({ ...wordSchema.parse(entry), deleted_at: entry.deleted_at, user_id: user.id }));
      const { error } = await supabase.from("word_entries").insert(rows);
      if (error?.code === "23505") {
        // A concurrent device may have added one of these meanings. Keep the rest.
        for (const entry of batch) {
          const { error: singleError } = await supabase.from("word_entries").insert({ ...wordSchema.parse(entry), deleted_at: entry.deleted_at, user_id: user.id });
          if (singleError && singleError.code !== "23505") throw singleError;
          if (!singleError) {
            count++;
            if (entry.review_state) {
              const { error: stateError } = await supabase.from("review_states").insert({ user_id: user.id, entry_id: entry.id, ...entry.review_state });
              if (stateError) throw stateError;
            }
          }
        }
        continue;
      }
      if (error) throw error;
      count += batch.length;
      const reviewRows = batch.filter((entry) => entry.review_state).map((entry) => ({ user_id: user.id, entry_id: entry.id, remembered: entry.review_state!.remembered, last_reviewed_at: entry.review_state!.last_reviewed_at }));
      if (reviewRows.length) {
        const { error: stateError } = await supabase.from("review_states").insert(reviewRows);
        if (stateError) throw stateError;
      }
    }
    revalidatePath("/");
    return { ok: true, count };
  } catch (error) { return { ok: false, error: message(error) }; }
}

function key(entry: Pick<WordInput, "word" | "part_of_speech" | "definition">) {
  return [entry.word, entry.part_of_speech, entry.definition].map((part) => part.trim().toLocaleLowerCase()).join("\u001f");
}
