import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Wadrobe",
  description: "A thoughtful, AI-assisted wardrobe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
