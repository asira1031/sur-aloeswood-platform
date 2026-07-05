import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUR Aloeswood | Co-Planter Management Platform",
  description: "Secure plantation, wallet, certificate, and co-planter management platform for SUR Aloeswood.",
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
