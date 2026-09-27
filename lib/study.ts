import type { WordEntry } from "./model";

export type StudyKind = "choice" | "write";
export type StudyQuestion = { entry: WordEntry; kind: StudyKind; options: string[] };

export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function isCorrectAnswer(value: string, word: string) {
  return normalizeAnswer(value) === normalizeAnswer(word);
}

export function uniqueWords(entries: WordEntry[]) {
  return [...new Map(entries.map((entry) => [normalizeAnswer(entry.word), entry.word])).values()];
}

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

export function choiceOptions(entry: WordEntry, entries: WordEntry[]) {
  const sameMeaning = new Set(entries.filter((item) => normalizeAnswer(item.definition) === normalizeAnswer(entry.definition)).map((item) => normalizeAnswer(item.word)));
  const alternatives = uniqueWords(entries).filter((word) => !isCorrectAnswer(word, entry.word) && !sameMeaning.has(normalizeAnswer(word)));
  const offset = alternatives.length ? hash(entry.id) % alternatives.length : 0;
  const rotated = [...alternatives.slice(offset), ...alternatives.slice(0, offset)];
  const options = [entry.word, ...rotated.slice(0, 3)];
  const correctIndex = hash(entry.definition + entry.id) % options.length;
  [options[0], options[correctIndex]] = [options[correctIndex], options[0]];
  return options;
}

export function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

export function makeTestQuestions(entries: WordEntry[]) {
  return shuffled(entries).map((entry, index) => {
    const options = choiceOptions(entry, entries);
    return { entry, kind: options.length > 1 && index % 2 === 0 ? "choice" : "write", options } satisfies StudyQuestion;
  });
}
