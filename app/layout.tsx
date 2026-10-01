import type { Metadata } from "next";
import "./globals.css";

// 글꼴은 globals.css의 Pretendard(npm 패키지) 하나만 쓴다 — 업무일지와 같은 MG 디자인.
export const metadata: Metadata = {
  title: { default: "Daniel Tech Wiki", template: "%s | Daniel Tech Wiki" },
  description: "IT 신기술을 공부하며 정리하는 학습 위키. 누구나 참고할 수 있습니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
