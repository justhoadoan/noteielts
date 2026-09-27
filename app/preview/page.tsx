import { notFound } from "next/navigation";
import { Notebook } from "@/components/notebook";
import { localDate, type WordEntry } from "@/lib/model";

export const dynamic = "force-dynamic";

export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const now = new Date().toISOString();
  const today = localDate();
  const yesterday = localDate("Asia/Ho_Chi_Minh", new Date(new Date(now).getTime() - 86400000));
  const sample = [
    { id: "c5f67b23-a086-4c2c-9387-f73a960b02b5", word: "serendipity", part_of_speech: "noun", definition: "The occurrence of pleasant discoveries by chance.", example: "Finding this café was pure serendipity.", note: "Đọc trong bài báo", added_date: today, remembered: true },
    { id: "dfc4f16c-6c66-4a9e-b148-9c67e476f904", word: "resilient", part_of_speech: "adjective", definition: "Able to recover quickly from difficulties.", example: "Children can be remarkably resilient.", note: "", added_date: today, remembered: false },
    { id: "9f8f5d8d-6685-46d2-82b8-36d6d632a725", word: "flourish", part_of_speech: "verb", definition: "To grow or develop in a healthy or vigorous way.", example: "The plants flourish in the sunlight.", note: "", added_date: yesterday, remembered: false },
  ];
  const entries: WordEntry[] = sample.map(({ remembered, ...entry }) => ({
    ...entry, user_id: "preview", version: 1, created_at: now, updated_at: now, deleted_at: null,
    source_name: "Free Dictionary API", source_url: "", review_state: remembered ? { user_id: "preview", entry_id: entry.id, remembered, last_reviewed_at: now } : null,
  }));
  return <Notebook initialEntries={entries} profile={{ user_id: "preview", timezone: "Asia/Ho_Chi_Minh", last_export_at: null }} email="preview@noteielts.local" now={now} />;
}
