import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeDefinition, parseDatamuseDefinitions } from "@/lib/dictionary";

type DictionaryEntry = { meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }> };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const word = request.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > 120) return NextResponse.json({ error: "Từ không hợp lệ." }, { status: 400 });
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  async function fallback() {
    const datamuse = new URL("https://api.datamuse.com/words");
    datamuse.searchParams.set("sp", word);
    datamuse.searchParams.set("md", "d");
    datamuse.searchParams.set("max", "10");
    const publicSourceUrl = datamuse.toString();
    if (process.env.DATAMUSE_API_KEY) datamuse.searchParams.set("api_key", process.env.DATAMUSE_API_KEY);
    try {
      const response = await fetch(datamuse, { signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } });
      if (!response.ok) throw new Error("Dictionary fallback unavailable");
      const definitions = parseDatamuseDefinitions(await response.json(), word);
      return NextResponse.json({ definitions, source_name: "Datamuse (Wiktionary/WordNet)", source_url: publicSourceUrl });
    } catch {
      return NextResponse.json({ error: "Từ điển đang bận. Bạn có thể điền nghĩa thủ công." }, { status: 502 });
    }
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3500), next: { revalidate: 86400 } });
    if (!response.ok) return fallback();
    const body: unknown = await response.json();
    const definitions = (Array.isArray(body) ? body as DictionaryEntry[] : [])
      .flatMap((entry) => (entry.meanings ?? []).flatMap((meaning) =>
        (meaning.definitions ?? []).map((definition) => ({
          part_of_speech: meaning.partOfSpeech ?? "other",
          ...normalizeDefinition(definition.definition ?? ""),
          example: definition.example ?? "",
        })),
      )).filter((item) => item.definition).slice(0, 40);
    if (!definitions.length) return fallback();
    return NextResponse.json({ definitions, source_name: "Free Dictionary API", source_url: url });
  } catch {
    return fallback();
  }
}
