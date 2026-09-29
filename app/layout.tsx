import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// next/font/google는 빌드 중에 구글 폰트를 내려받는데, 그 요청이 실패해 배포가 깨진 적이 있다.
// 같은 폰트를 npm(@fontsource) 패키지의 파일로 번들해 빌드가 외부 네트워크에 의존하지 않게 한다.
const jetbrainsMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--nx-mono",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--nx-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Daniel Tech Wiki", template: "%s | Daniel Tech Wiki" },
  description: "IT 신기술을 공부하며 정리하는 학습 위키. 누구나 참고할 수 있습니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
