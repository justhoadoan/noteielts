import { z } from "zod";

export const wordSchema = z.object({
  id: z.uuid(),
  word: z.string().trim().min(1).max(120),
  part_of_speech: z.string().trim().min(1).max(40),
  definition: z.string().trim().min(1).max(1000),
  example: z.string().trim().max(1500).default(""),
  note: z.string().trim().max(2000).default(""),
  added_date: z.iso.date(),
  source_name: z.string().trim().max(120).default(""),
  source_url: z.url().max(500).or(z.literal("")).default(""),
});

export type WordInput = z.infer<typeof wordSchema>;
export type WordEntry = WordInput & {
  user_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  review_state?: ReviewState | null;
};
export type ReviewState = {
  user_id: string;
  entry_id: string;
  remembered: boolean;
  last_reviewed_at: string;
};
export type Profile = {
  user_id: string;
  timezone: string;
  last_export_at: string | null;
};
export type Backup = {
  format: "noteielts-v1";
  exported_at: string;
  entries: Array<WordInput & { deleted_at: string | null; review_state: Pick<ReviewState, "remembered" | "last_reviewed_at"> | null }>;
};
export const backupSchema = z.object({
  format: z.literal("noteielts-v1"),
  exported_at: z.iso.datetime(),
  entries: z.array(wordSchema.extend({
    deleted_at: z.iso.datetime({ offset: true }).nullable(),
    review_state: z.object({ remembered: z.boolean(), last_reviewed_at: z.iso.datetime({ offset: true }) }).nullable(),
  })).max(2000),
});

export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
export function localDate(timezone = DEFAULT_TIMEZONE, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function displayDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
