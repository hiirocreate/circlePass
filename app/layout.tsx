import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "会員証・順番待ち",
  description: "LINEミニアプリ サブスク会員証・順番待ちシステム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-base-white text-base-black min-h-screen font-sans antialiased">
        <div className="mx-auto max-w-md min-h-screen bg-white">{children}</div>
      </body>
    </html>
  );
}
