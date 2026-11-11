import type { Metadata, Viewport } from "next";
import { Google_Sans_Flex, Google_Sans_Code } from "next/font/google";
import "./globals.css";

const gsans = Google_Sans_Flex({ variable: "--font-gsans", subsets: ["latin"], weight: "variable", display: "swap" });
const gcode = Google_Sans_Code({ variable: "--font-gcode", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Talent Lens",
  description: "Resume extraction, classification and explainable ranking for the LCA Consultant and UI/UX Intern roles.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('tl-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${gsans.variable} ${gcode.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
