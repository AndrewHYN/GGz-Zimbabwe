import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "GGz | Gaming platform for Zimbabwe",
    template: "%s | GGz",
  },
  description: "GGz is a home for players to discover, compete, and build reputation.",
  openGraph: {
    title: "GGz | Gaming platform for Zimbabwe",
    description: "GGz is a home for players to discover, compete, and build reputation.",
    type: "website",
    locale: "en_ZA",
    siteName: "GGz",
  },
  twitter: {
    card: "summary_large_image",
    title: "GGz | Gaming platform for Zimbabwe",
    description: "GGz is a home for players to discover, compete, and build reputation.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ggz-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme:light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <Navigation />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
