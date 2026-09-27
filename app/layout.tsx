import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteIelts · Sổ từ vựng của bạn",
  description: "Ghi lại từ mới, học flashcard theo ngày và giữ dữ liệu của bạn lâu dài.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
