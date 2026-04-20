import { Fraunces, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});

export const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-serif",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});
