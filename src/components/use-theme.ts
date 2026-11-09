"use client";

import { useSyncExternalStore } from "react";

import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return matchMedia(DARK_QUERY).matches;
}

function syncDocument() {
  const dark = resolveTheme(readPreference(), systemPrefersDark()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    matchMedia(DARK_QUERY).addEventListener("change", syncDocument);
    // Fires only for other tabs, which keeps them all on the same theme.
    window.addEventListener("storage", syncDocument);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      matchMedia(DARK_QUERY).removeEventListener("change", syncDocument);
      window.removeEventListener("storage", syncDocument);
    }
  };
}

function writePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be blocked, which leaves the app following the system theme.
  }
  syncDocument();
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "system" as const,
  );
  const systemDark = useSyncExternalStore(
    subscribe,
    systemPrefersDark,
    () => false,
  );

  return {
    preference,
    resolvedTheme: resolveTheme(preference, systemDark),
    setPreference: writePreference,
  };
}
