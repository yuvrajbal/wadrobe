import { afterEach, describe, expect, it, vi } from "vitest";

import {
  nextThemePreference,
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "@/lib/theme";

describe("parseThemePreference", () => {
  it("keeps stored preferences", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to system for missing or unknown values", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("sepia")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("lets an explicit preference win over the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system otherwise", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("nextThemePreference", () => {
  it("cycles through every preference", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });
});

describe("themeInitScript", () => {
  function run({
    stored,
    systemDark,
    storageThrows = false,
  }: {
    stored: string | null;
    systemDark: boolean;
    storageThrows?: boolean;
  }) {
    const toggle = vi.fn();
    const getItem = vi.fn((key: string) => {
      if (storageThrows) throw new Error("Storage is blocked");
      return key === THEME_STORAGE_KEY ? stored : null;
    });

    vi.stubGlobal("localStorage", { getItem });
    vi.stubGlobal("matchMedia", () => ({ matches: systemDark }));
    vi.stubGlobal("document", {
      documentElement: { classList: { toggle } },
    });

    new Function(themeInitScript)();
    return toggle.mock.calls[0];
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { stored: "dark", systemDark: false, dark: true },
    { stored: "light", systemDark: true, dark: false },
    { stored: "system", systemDark: true, dark: true },
    { stored: null, systemDark: true, dark: true },
    { stored: null, systemDark: false, dark: false },
    { stored: "sepia", systemDark: true, dark: true },
  ])(
    "agrees with resolveTheme for $stored when system dark is $systemDark",
    ({ stored, systemDark, dark }) => {
      expect(run({ stored, systemDark })).toEqual(["dark", dark]);
      expect(resolveTheme(parseThemePreference(stored), systemDark)).toBe(
        dark ? "dark" : "light",
      );
    },
  );

  it("falls back to the system when storage is unavailable", () => {
    expect(
      run({ stored: "light", systemDark: true, storageThrows: true }),
    ).toEqual(["dark", true]);
  });
});
