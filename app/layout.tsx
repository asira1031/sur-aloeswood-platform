
import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterServiceWorker from "@/app/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "SUR Aloeswood | Co-Planter Management Platform",
  description:
    "Secure plantation, wallet, certificate, and co-planter management platform for SUR Aloeswood.",
  applicationName: "SUR Aloeswood",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/sur-logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "SUR Aloeswood",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "SUR Aloeswood",
    description:
      "Secure plantation, wallet, certificate, and co-planter management platform for SUR Aloeswood.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#06170f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
  <RegisterServiceWorker />
  {children}</body>
    </html>
  );
}