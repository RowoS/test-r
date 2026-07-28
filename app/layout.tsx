import type { Metadata } from "next";
import { Inter, Red_Hat_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable:'--font-sans',
  subsets:['latin']
});

const redHatDisplay = Red_Hat_Display({
  variable: "--font-red-hat-display",
  subsets: ["latin"],
  weight: ["400", "800", "900"]
});

export const metadata: Metadata = {
  title: "Sci.Port",
  description: "IT Support Ticket Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", inter.variable, redHatDisplay.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
