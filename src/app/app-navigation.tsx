"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Wardrobe", icon: "▦" },
  { href: "/builder", label: "Builder", icon: "◇" },
  { href: "/suggestions", label: "Suggestions", icon: "✦" },
  { href: "/saved", label: "Saved", icon: "♡" },
] as const;

export function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-[#f7f5ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-950 text-sm font-semibold text-[#f7f5ef]">
              W
            </span>
            <span>
              <span className="block font-semibold tracking-[-0.02em]">
                wadrobe
              </span>
              <span className="hidden text-xs text-emerald-950/50 sm:block">
                Your closet, considered
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-emerald-950 text-white"
                      : "text-emerald-950/55 hover:bg-white/70 hover:text-emerald-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-[1.35rem] border border-emerald-950/10 bg-[#f7f5ef]/95 p-1.5 shadow-[0_22px_60px_-18px_rgba(6,78,59,0.45)] backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-semibold transition ${
                active ? "bg-emerald-950 text-white" : "text-emerald-950/55"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
