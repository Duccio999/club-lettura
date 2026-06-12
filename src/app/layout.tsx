import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Club Lettura",
  description: "Piccolo spazio privato per aggiungere libri e commentarli insieme.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Club Lettura",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#fff9ef",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
