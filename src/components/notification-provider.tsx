"use client";

import { Toaster } from "sonner";

export function NotificationProvider() {
  return (
    <Toaster
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
