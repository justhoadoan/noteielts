import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return NextResponse.json({ suggestions: [] });
  const url = new URL("https://api.datamuse.com/sug");
  url.searchParams.set("s", q);
  url.searchParams.set("max", "8");
  if (process.env.DATAMUSE_API_KEY) url.searchParams.set("api_key", process.env.DATAMUSE_API_KEY);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4500), next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: "Chưa tải được gợi ý. Bạn vẫn có thể nhập từ thủ công." }, { status: 502 });
    const body: unknown = await response.json();
    const suggestions = Array.isArray(body) ? body.filter((item): item is { word: string } => typeof item?.word === "string").map((item) => item.word).slice(0, 8) : [];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Dịch vụ gợi ý đang bận. Bạn vẫn có thể nhập từ thủ công." }, { status: 502 });
  }
}
