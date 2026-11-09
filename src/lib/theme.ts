export const THEME_STORAGE_KEY = "wadrobe-theme";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: string | null): ThemePreference {
  return THEME_PREFERENCES.find((theme) => theme === value) ?? "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference !== "system") return preference;
  return systemPrefersDark ? "dark" : "light";
}

export function nextThemePreference(
  preference: ThemePreference,
): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}

/**
 * Runs in <head> before first paint so a dark-mode reload never flashes light.
 * It has to be self-contained, so it repeats the logic of `resolveTheme`.
 */
export const themeInitScript = `(function(){var p=null;try{p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})()`;
