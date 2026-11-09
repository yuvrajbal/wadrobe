import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AppNavigation } from "@/app/app-navigation";
import { NotificationProvider } from "@/components/notification-provider";
import { themeInitScript } from "@/lib/theme";

import "./globals.css";

// Clerk's widgets render outside our Tailwind classes, so point them at the
// theme variables. They then follow the `.dark` class with no JS of their own.
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--brand)",
    colorBackground: "var(--surface)",
    colorForeground: "var(--foreground)",
    colorInput: "var(--card)",
    colorInputForeground: "var(--foreground)",
    colorNeutral: "var(--foreground)",
  },
};

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
    // The init script sets the theme class before hydration, so the server's
    // <html> attributes are expected to differ from the DOM.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ClerkProvider appearance={clerkAppearance}>
          <AppNavigation>{children}</AppNavigation>
          <NotificationProvider />
        </ClerkProvider>
      </body>
    </html>
  );
}
