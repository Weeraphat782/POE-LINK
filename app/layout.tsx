import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { CloseDetailsOnOutsideClick } from "@/app/close-details-on-outside-click";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Stash — PoE2 Guild Links",
  description: "Shared build & buy links, organized like stash tabs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CloseDetailsOnOutsideClick />
        <header className="border-b border-panel-border bg-panel/60">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
            <span className="text-lg text-gold-bright">⛨</span>
            <Link
              href="/"
              className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground hover:text-gold-bright"
            >
              The Stash
            </Link>
            <span className="text-xs text-muted">Guild link tabs for PoE2</span>
            <Link
              href={user ? "/account" : "/login"}
              className="ml-auto text-xs uppercase tracking-wide text-muted hover:text-gold-bright"
            >
              {user ? "Account" : "Sign in"}
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
