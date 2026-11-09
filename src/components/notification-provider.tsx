"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/use-theme";

export function NotificationProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      closeButton
      richColors
      position="top-center"
      visibleToasts={3}
      duration={6_000}
      mobileOffset={{ top: 16, left: 16, right: 16 }}
      offset={{ top: 24, right: 24 }}
      containerAriaLabel="Notifications"
      toastOptions={{ closeButtonAriaLabel: "Dismiss notification" }}
    />
  );
}
