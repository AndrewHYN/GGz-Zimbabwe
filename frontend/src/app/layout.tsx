import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "GGz | Local competitions & players",
    template: "%s | GGz",
  },
  description:
    "Find local gaming competitions, meet players and follow real results in Zimbabwe.",
  openGraph: {
    title: "GGz | Local competitions & players",
    description:
      "Find local gaming competitions, meet players and follow real results in Zimbabwe.",
    type: "website",
    locale: "en_ZA",
    siteName: "GGz",
  },
  twitter: {
    card: "summary_large_image",
    title: "GGz | Local competitions & players",
    description:
      "Find local gaming competitions, meet players and follow real results in Zimbabwe.",
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
            __html: `(function(){try{var t=localStorage.getItem("ggz-theme");if(t!=="dark"&&t!=="light"){t="dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <MotionProvider>
          <Navigation />
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <main id="main-content" className="min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
