import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wiki-root">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="logo">
            📘 Daniel <span>Tech Wiki</span>
          </Link>
          <nav className="header-nav">
            <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer">
              블로그
            </a>
            <a href="https://github.com/Leemingi6901/Daniel-New-Project" target="_blank" rel="noreferrer">
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
    </div>
  );
}
