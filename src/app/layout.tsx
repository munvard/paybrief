import type { Metadata } from "next";
import { fraunces, plexSerif, plexMono } from "@/lib/fonts";
import { StatusBar } from "@/components/status-bar";
import { TickerTape } from "@/components/ticker-tape";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Foundry — AI that gives birth to AI",
  description:
    "Describe an AI tool in one sentence. 3 minutes later it is live on BuildWithLocus with its own USDC wallet, its own paying customers, and an MCP endpoint. Every tool pays for its own hosting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSerif.variable} ${plexMono.variable}`}
    >
      <body>
        <StatusBar />
        <TickerTape />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
