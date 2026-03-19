import type { Metadata } from "next";
import { Fraunces, Geist, Roboto } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Guruji Bay Area",
  description: "Community portal for members and administrators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${geist.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
