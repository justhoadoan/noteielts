import test from "node:test";
import assert from "node:assert/strict";
import { backupSchema, localDate, wordSchema } from "../lib/model.ts";
import { normalizeDefinition, parseDatamuseDefinitions } from "../lib/dictionary.ts";

test("ngày ghi từ dùng múi giờ Việt Nam cả khi UTC còn ngày trước", () => {
  assert.equal(localDate("Asia/Ho_Chi_Minh", new Date("2026-09-27T17:30:00Z")), "2026-09-28");
  assert.equal(localDate("UTC", new Date("2026-09-27T17:30:00Z")), "2026-09-27");
});

test("không chấp nhận mục từ thiếu nghĩa hoặc ngày không hợp lệ", () => {
  const base = { id: "4b576b4d-7344-4285-96f4-5a2d7becb169", word: "serendipity", part_of_speech: "noun", definition: "a pleasant discovery", added_date: "2026-09-27" };
  assert.equal(wordSchema.safeParse(base).success, true);
  assert.equal(wordSchema.safeParse({ ...base, definition: "" }).success, false);
  assert.equal(wordSchema.safeParse({ ...base, added_date: "2026-02-31" }).success, false);
});

test("bản sao lưu phải đúng phiên bản và gồm trạng thái thùng rác", () => {
  const backup = { format: "noteielts-v1", exported_at: "2026-09-27T00:00:00.000Z", entries: [] };
  assert.equal(backupSchema.safeParse(backup).success, true);
  assert.equal(backupSchema.safeParse({ ...backup, format: "unknown" }).success, false);
  assert.equal(backupSchema.safeParse({ ...backup, entries: [{ id: "4b576b4d-7344-4285-96f4-5a2d7becb169", word: "test", part_of_speech: "noun", definition: "a trial", added_date: "2026-09-27" }] }).success, false);
});

test("nguồn từ điển dự phòng chỉ lấy đúng từ và phân loại nghĩa", () => {
  const raw = [
    { word: "resiliant", defs: ["adj\twrong spelling"] },
    { word: "resilient", defs: ["adj\tAble to recover quickly.", "n\tA resilient person."] },
  ];
  assert.deepEqual(parseDatamuseDefinitions(raw, "resilient"), [
    { part_of_speech: "adjective", definition: "Able to recover quickly.", example: "" },
    { part_of_speech: "noun", definition: "A resilient person.", example: "" },
  ]);
});

test("nghĩa tham chiếu được tách khỏi ghi chú biến thể, nghĩa thường giữ nguyên", () => {
  const raw = [{ word: "graps", defs: ["v\t(chiefly African-American Vernacular and UK, dialectal) Alternative form of grasp. [To grip; to take hold, particularly with the hand.] "] }];
  assert.deepEqual(parseDatamuseDefinitions(raw, "graps"), [{
    part_of_speech: "verb",
    definition: "To grip; to take hold, particularly with the hand.",
    usage_note: "(chiefly African-American Vernacular and UK, dialectal) Alternative form of grasp.",
    example: "",
  }]);
  assert.deepEqual(normalizeDefinition("A bracketed note [used in context]."), { definition: "A bracketed note [used in context]." });
});
