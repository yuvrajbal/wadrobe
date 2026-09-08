import type { Metadata } from "next";

import { AppNavigation } from "@/app/app-navigation";
import { NotificationProvider } from "@/components/notification-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wadrobe",
    template: "%s · Wadrobe",
  },
  description: "A thoughtful, AI-assisted wardrobe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppNavigation>{children}</AppNavigation>
        <NotificationProvider />
      </body>
    </html>
  );
}
