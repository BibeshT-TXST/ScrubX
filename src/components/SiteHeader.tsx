"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Chat" },
  { href: "/security", label: "Security Division" },
];

/** `model` is null when no model is configured: every chat will report it couldn't connect. */
export function SiteHeader({ model }: { model: string | null }) {
  const pathname = usePathname();
  return (
    <header className="flex items-center gap-6 border-b px-6 py-3">
      <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
        ScrubX
      </Link>
      <nav className="flex gap-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              pathname === href ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        synthetic demo data ·{" "}
        {model ?? (
          <span className="flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
            <WifiOff className="size-3" /> no model connected
          </span>
        )}
      </span>
    </header>
  );
}
