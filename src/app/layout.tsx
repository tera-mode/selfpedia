import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "じぶんクラフト",
  description: "AIとの会話や診断で自分の特徴を集め、自己PR・プロフィール等のアウトプットを生成",
  icons: {
    icon: "/image/mecraft_fav.png",
    apple: "/image/mecraft_fav.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
