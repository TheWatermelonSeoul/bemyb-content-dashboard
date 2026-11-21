import type { Metadata } from "next";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "비마이비 콘텐츠 성과 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <Nav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
