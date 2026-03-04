import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "品牌营销长图生成器 | Brand Campaign Generator",
  description: "AI驱动的品牌调性分析 + 微信长图一键生成。上传品牌素材，输入创意需求，即刻产出符合品牌调性的4K微信长图文。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
