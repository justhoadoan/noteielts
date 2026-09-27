"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Cloud, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export function SignIn({ authError = false }: { authError?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(authError ? "Không hoàn tất được đăng nhập. Hãy thử lại." : "");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");
  async function signIn() {
    setPending(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError("Không bắt đầu được đăng nhập. Hãy kiểm tra cấu hình Google trong Supabase."); setPending(false); }
  }
  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault(); setError(""); setSuccess(""); setPending(true);
    const supabase = createClient();
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` });
      setPending(false);
      if (error) setError("Chưa gửi được email đặt lại mật khẩu. Hãy thử lại.");
      else setSuccess("Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); setPending(false); return; }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      setPending(false);
      if (error) setError("Không tạo được tài khoản. Kiểm tra email, mật khẩu hoặc thử lại sau.");
      else if (data.session) { router.push("/"); router.refresh(); }
      else setSuccess("Hãy mở email và xác nhận tài khoản, sau đó quay lại đăng nhập.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) setError("Email hoặc mật khẩu chưa đúng, hoặc email chưa được xác nhận.");
    else { router.push("/"); router.refresh(); }
  }
  return <main className="signin-page">
    <div className="signin-nav"><span className="brand-mark">N</span><strong>NoteIelts</strong><span className="signin-nav-caption">Sổ từ vựng cá nhân</span></div>
    <div className="signin-grid">
      <section className="signin-intro">
        <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Không gian học của riêng bạn</span>
        <h1>Mỗi từ mới,<br /><span>một bước tiến.</span></h1>
        <p>Ghi lại từ bạn gặp mỗi ngày. Xem nghĩa tiếng Anh, học bằng flashcard và mang cả cuốn sổ theo mình đến mọi thiết bị.</p>
        <div className="signin-features"><span><BookOpenText aria-hidden="true" /> Ghi từ theo ngày</span><span><Layers3 aria-hidden="true" /> Ôn tập bằng flashcard</span><span><Cloud aria-hidden="true" /> Đồng bộ an toàn</span></div>
      </section>
      <section className="signin-panel" aria-label="Đăng nhập">
        <div className="signin-illustration" aria-hidden="true"><div className="illustration-date">TODAY&apos;S WORD</div><div className="illustration-word">serendipity</div><div className="illustration-type">noun</div><div className="illustration-line" /><div className="illustration-definition">Finding something beautiful<br />without looking for it.</div></div>
        <h2>{mode === "signup" ? "Tạo tài khoản của bạn" : mode === "forgot" ? "Đặt lại mật khẩu" : "Bắt đầu cuốn sổ của bạn"}</h2><p>{mode === "forgot" ? "Nhập email để nhận liên kết đặt lại." : "Đăng nhập để từ vựng luôn ở bên bạn."}</p>
        <form className="auth-form" onSubmit={submitCredentials}><label className="auth-label" htmlFor="auth-email">Email</label><Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          {mode !== "forgot" && <><label className="auth-label" htmlFor="auth-password">Mật khẩu</label><Input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" /></>}
          {mode === "login" && <button type="button" className="auth-link auth-forgot" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}>Quên mật khẩu?</button>}
          <Button className="h-11 w-full mt-5" disabled={pending}>{pending ? "Vui lòng chờ…" : mode === "signup" ? "Tạo tài khoản" : mode === "forgot" ? "Gửi email đặt lại" : "Đăng nhập bằng email"}</Button>
        </form>
        <div className="auth-switch">{mode === "login" ? <>Chưa có tài khoản? <button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Đăng ký</button></> : <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Quay lại đăng nhập</button>}</div>
        {mode !== "forgot" && <div className="auth-divider"><span>hoặc</span></div>}
        {mode !== "forgot" && <Button variant="outline" className="google-button" onClick={signIn} disabled={pending}>{pending ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}</Button>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="success-message" role="status">{success}</p>}
        <small>Dữ liệu từ vựng được lưu trong tài khoản của bạn.</small>
      </section>
    </div>
  </main>;
}
