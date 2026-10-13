"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Chat" },
  { href: "/dev", label: "Dev View" },
];

export function SiteHeader({ model }: { model: string }) {
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
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">synthetic demo data · {model}</span>
    </header>
  );
}
