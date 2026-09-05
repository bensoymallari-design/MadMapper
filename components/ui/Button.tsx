"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  children: ReactNode;
}

export function Button({ className, variant = "secondary", size = "md", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "border-sky-400/70 bg-sky-500/18 text-sky-100 hover:bg-sky-500/28",
        variant === "secondary" && "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
        variant === "ghost" && "border-transparent bg-transparent text-slate-300 hover:bg-slate-800/70",
        variant === "danger" && "border-red-500/60 bg-red-950/45 text-red-100 hover:bg-red-900/60",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-3 text-sm",
        size === "icon" && "h-9 w-9 p-0",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
