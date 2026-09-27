"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Mật khẩu cần ít nhất 8 ký tự."); return; }
    setBusy(true);
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) { setError("Liên kết đặt lại đã hết hạn. Hãy gửi yêu cầu mới."); setBusy(false); return; }
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) setError("Không đổi được mật khẩu. Hãy thử gửi lại email đặt lại."); else setDone(true);
  }
  return <main className="setup-page"><div className="setup-card"><span className="brand-mark">N</span><h1>Đặt mật khẩu mới</h1>{done ? <><p>Mật khẩu đã được cập nhật.</p><Link className="auth-link" href="/">Vào sổ từ →</Link></> : <form onSubmit={submit}><label className="auth-label" htmlFor="new-password">Mật khẩu mới</label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" className="h-11 w-full mt-5" disabled={busy}>{busy ? "Đang lưu…" : "Lưu mật khẩu mới"}</Button><Link className="auth-link" href="/">Quay về đăng nhập</Link></form>}</div></main>;
}
