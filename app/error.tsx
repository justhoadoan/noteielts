"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="setup-page"><div className="setup-card"><span className="brand-mark">N</span><h1>Chưa mở được sổ từ</h1><p>Đường truyền hoặc kho dữ liệu có thể đang gián đoạn. Từ đã lưu trên cloud và bản sao JSON của bạn vẫn có thể dùng khi kết nối trở lại.</p><Button className="h-11 mt-5" onClick={reset}>Thử lại</Button></div></main>;
}
