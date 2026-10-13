import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { GEMINI_DEFAULT_MODEL } from "@/core";
import { scrubx } from "@/server/scrubx";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScrubX",
  description: "Secure inference pipeline between clinical chat and an LLM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { llm } = scrubx().config;
  const model = llm.apiKey ? `gemini · ${llm.model ?? GEMINI_DEFAULT_MODEL}` : null;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden">
        <SiteHeader model={model} />
        {children}
      </body>
    </html>
  );
}
