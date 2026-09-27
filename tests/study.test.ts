import assert from "node:assert/strict";
import test from "node:test";
import { choiceOptions, isCorrectAnswer, makeTestQuestions } from "../lib/study.ts";
import type { WordEntry } from "../lib/model.ts";

function entry(id: string, word: string, definition: string): WordEntry {
  return {
    id, word, definition, part_of_speech: "noun", example: "", note: "", added_date: "2026-09-27",
    source_name: "", source_url: "", user_id: "test", version: 1, created_at: "", updated_at: "", deleted_at: null,
  };
}

test("chấm câu gõ không phân biệt hoa thường và khoảng trắng thừa", () => {
  assert.equal(isCorrectAnswer("  Take   OFF  ", "take off"), true);
  assert.equal(isCorrectAnswer("take on", "take off"), false);
});

test("câu trắc nghiệm không lặp từ hoặc dùng nghĩa giống hệt làm đáp án nhiễu", () => {
  const first = entry("00000000-0000-4000-8000-000000000001", "happy", "Feeling joy");
  const entries = [
    first,
    entry("00000000-0000-4000-8000-000000000002", "glad", "Feeling joy"),
    entry("00000000-0000-4000-8000-000000000003", "happy", "A fortunate event"),
    entry("00000000-0000-4000-8000-000000000004", "calm", "Not agitated"),
  ];
  const options = choiceOptions(first, entries);
  assert.equal(options.filter((word) => word === "happy").length, 1);
  assert.ok(options.includes("calm"));
  assert.ok(!options.includes("glad"));
});

test("bài kiểm tra dùng mỗi mục một lần và chuyển sang gõ nếu thiếu đáp án nhiễu", () => {
  const entries = [
    entry("00000000-0000-4000-8000-000000000001", "happy", "Feeling joy"),
    entry("00000000-0000-4000-8000-000000000002", "glad", "Feeling joy"),
  ];
  const questions = makeTestQuestions(entries);
  assert.deepEqual(new Set(questions.map((question) => question.entry.id)), new Set(entries.map((item) => item.id)));
  assert.ok(questions.every((question) => question.kind === "write"));
});
