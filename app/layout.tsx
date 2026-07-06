import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUR Aloeswood Co-Planter Platform",
  description:
    "A transparent agarwood co-planter management platform for tree records, wallet ledgers, gardener tasks, support, and harvest monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
