import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Player from "@/components/Player";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Music Streaming PWA",
  description: "A clean, minimalistic music streaming app.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        {children}
        <Player />
      </body>
    </html>
  );
}