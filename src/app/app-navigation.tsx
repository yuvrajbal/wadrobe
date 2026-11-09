"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Wardrobe", icon: "▦" },
  { href: "/builder", label: "Build", icon: "◇" },
  { href: "/suggestions", label: "Suggest", icon: "✦" },
  { href: "/saved", label: "Saved", icon: "♡" },
] as const;

export function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[60] inline-flex min-h-11 -translate-y-20 items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-canvas/88 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[4.5rem] w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link
            href="/"
            className="group flex min-h-11 items-center gap-3 rounded-xl"
            aria-label="Wadrobe home"
          >
            <span className="display-type grid h-10 w-10 place-items-center rounded-[0.9rem] bg-brand text-lg text-[#f7f5ef] shadow-[0_8px_24px_-12px_rgba(6,78,59,0.8)] transition group-hover:-rotate-3">
              w.
            </span>
            <span>
              <span className="block text-[0.95rem] font-semibold tracking-[-0.025em] text-ink">
                wadrobe
              </span>
              <span className="hidden text-[0.68rem] tracking-wide text-ink/45 sm:block">
                Your closet, considered.
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-full border border-ink/8 bg-card/45 p-1 md:flex"
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
                  className={`rounded-full px-4 py-2 text-[0.82rem] font-semibold transition ${
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink/55 hover:bg-card/80 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Show when="signed-out">
              <SignInButton>
                <button className="min-h-10 rounded-full px-4 text-[0.8rem] font-semibold text-ink transition hover:bg-card/70">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="min-h-10 rounded-full bg-[#c7623d] px-4 text-[0.8rem] font-semibold text-white shadow-sm transition hover:bg-[#b75533]">
                  Create account
                </button>
              </SignUpButton>
            </Show>

            <Show when="signed-in">
              <Link
                href="/suggestions"
                className="hidden min-h-10 items-center rounded-full bg-[#c7623d] px-4 text-[0.8rem] font-semibold text-white shadow-[0_12px_25px_-16px_rgba(150,61,30,0.9)] transition hover:-translate-y-0.5 hover:bg-[#b75533] lg:flex"
              >
                Get dressed&nbsp; →
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <div id="main-content">{children}</div>

      <Show when="signed-in">
        <nav
          className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-[1.4rem] border border-ink/10 bg-surface/94 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_22px_60px_-18px_rgba(6,78,59,0.42)] backdrop-blur-2xl md:hidden"
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
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.05rem] text-[0.65rem] font-semibold transition ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink/50 active:bg-ink/5"
                }`}
              >
                <span
                  className="text-[1.05rem] leading-none"
                  aria-hidden="true"
                >
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </Show>
    </>
  );
}
