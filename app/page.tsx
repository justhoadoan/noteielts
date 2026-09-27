import { createClient } from "@/lib/supabase/server";
import { getAllEntries } from "@/app/actions";
import { Notebook } from "@/components/notebook";
import { SignIn } from "@/components/sign-in";
import type { Profile } from "@/lib/model";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <main className="setup-page"><div className="setup-card"><span className="brand-mark">N</span><h1>NoteIelts đang chờ kết nối</h1><p>Thêm Supabase URL và publishable key vào <code>.env.local</code>, rồi chạy migration trong <code>supabase/migrations</code>. Xem README để hoàn tất đăng nhập Google.</p></div></main>;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <SignIn authError={(await searchParams).auth_error === "1"} />;
  const [entries, profileResult] = await Promise.all([
    getAllEntries(),
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const profile: Profile = profileResult.data ?? { user_id: user.id, timezone: "Asia/Ho_Chi_Minh", last_export_at: null };
  return <Notebook initialEntries={entries} profile={profile} email={user.email ?? ""} now={new Date().toISOString()} />;
}
