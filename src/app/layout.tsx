import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "VANDOOT — Intelligent Monitoring",
  description:
    "Intelligent Distributed Monitoring & Communication. Your entire IoT network, one clear picture.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
