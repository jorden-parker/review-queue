import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RainbowRule } from "@/components/common/otter";
import { SkipLink } from "@/components/common/skip-link";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Calm, structured pull request reviews.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <SkipLink />
        <RainbowRule />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
