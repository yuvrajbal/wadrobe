"use client";

import { useTheme } from "@/components/use-theme";
import { nextThemePreference, type ThemePreference } from "@/lib/theme";

const icons: Record<ThemePreference, React.ReactNode> = {
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
};

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const next = nextThemePreference(preference);
  const label = `Theme: ${preference}. Switch to ${next}.`;

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-full text-ink/65 transition hover:bg-card/70 hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[1.15rem] w-[1.15rem]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icons[preference]}
      </svg>
    </button>
  );
}
