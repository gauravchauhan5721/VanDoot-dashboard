import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./polish.css";
import "./control-room.css";
export const metadata: Metadata = {
  title: "VanDoot | Forest control room",
  description:
    "Forest monitoring, node media, and evidence review for rangers.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
