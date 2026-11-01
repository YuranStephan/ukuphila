import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Hanken_Grotesk } from "next/font/google";
import "@/styles/base.css";
import "@/styles/site.css";
import "@/styles/console.css";
import "@/styles/app.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["opsz", "wdth"], display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3200"),
  title: { default: "Ukuphila — Ajudar primeiro. Pedir depois.", template: "%s · Ukuphila" },
  description: "A memória do negócio para quem vende nos mercados de Maputo: caixa, stock, fiado, poupança e Xitique, com agente, voz e sem precisar de internet. O crédito vem depois.",
  applicationName: "Ukuphila",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#071F1A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-MZ" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
