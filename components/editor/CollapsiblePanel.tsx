"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsiblePanel({ title, description, defaultOpen = false, children }: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-900/70"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{title}</span>
          {description && <span className="mt-1 block truncate text-xs text-slate-500">{description}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-slate-800 p-3">{children}</div>}
    </section>
  );
}
