import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppHeader } from "@/components/app/AppHeader";
import { Providers } from "@/components/app/Providers";
import { GEMINI_DEFAULT_MODEL } from "@/core";
import { DISPLAY_BOOTSTRAP } from "@/lib/display-bootstrap";
import { scrubx } from "@/server/scrubx";
import "./globals.css";

// Inter for UI and reading text, JetBrains Mono for IDs, MRNs and doses: both keep
// Il1, O0 and rn/m apart, which a clinical screen can't leave to chance.
const ui = Inter({ variable: "--font-ui", subsets: ["latin"], display: "swap" });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "ScrubX",
  description: "Secure inference pipeline between clinical chat and an LLM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { llm, patientSource } = scrubx().config;
  return (
    // The bootstrap script sets the theme class and density before React hydrates.
    <html lang="en" className={`${ui.variable} ${code.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOTSTRAP }} />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden">
        <Providers>
          <AppHeader model={llm.apiKey ? (llm.model ?? GEMINI_DEFAULT_MODEL) : null} source={patientSource} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
