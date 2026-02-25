import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nowify – LMS Procrastination Monitor",
  description: "Intelligent system for studying the effect of procrastination on academic performance",
  icons: { icon: "/images/logo_nowify.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
