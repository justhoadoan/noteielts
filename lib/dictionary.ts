export type Definition = { part_of_speech: string; definition: string; example: string };

const POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };

export function parseDatamuseDefinitions(raw: unknown, expectedWord: string): Definition[] {
  if (!Array.isArray(raw)) return [];
  const matched = raw.find((item) => typeof item?.word === "string" && item.word.toLocaleLowerCase() === expectedWord.toLocaleLowerCase());
  if (!matched || !Array.isArray(matched.defs)) return [];
  return matched.defs.filter((item: unknown): item is string => typeof item === "string")
    .map((item: string) => {
      const separator = item.indexOf("\t");
      const code = separator >= 0 ? item.slice(0, separator) : "";
      return { part_of_speech: POS[code] ?? "other", definition: (separator >= 0 ? item.slice(separator + 1) : item).trim(), example: "" };
    }).filter((item: Definition) => item.definition).slice(0, 40);
}
