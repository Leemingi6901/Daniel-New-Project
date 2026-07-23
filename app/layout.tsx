import type { Metadata } from "next";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Daniel Tech Wiki", template: "%s | Daniel Tech Wiki" },
  description: "IT 신기술을 공부하며 정리하는 학습 위키. 누구나 참고할 수 있습니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="logo">
              📘 Daniel <span>Tech Wiki</span>
            </Link>
            <nav className="header-nav">
              <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer">
                블로그
              </a>
              <a href="https://github.com/Leemingi6901" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <div className="site-body">
          <Sidebar />
          <main className="site-main">{children}</main>
        </div>
        <footer className="site-footer">
          개인 학습을 위해 정리한 노트입니다. 오류 제보와 참고는 언제나 환영합니다.
        </footer>
      </body>
    </html>
  );
}
