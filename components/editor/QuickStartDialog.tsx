"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QuickStartDialogProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  "Enter module physical size",
  "Enter wall width and height",
  "Enter cabinet size",
  "Enter module pixel width and height",
  "Fit the wall, then start mapping cabinets, ports, and power"
];

export function QuickStartDialog({ open, onClose }: QuickStartDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-lg rounded-2xl p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-sky-50">Quick start</h2>
            <p className="mt-1 text-sm text-slate-400">Set up the physical LED wall before drawing routes or assigning power.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-400/50 bg-sky-500/15 text-xs font-semibold text-sky-100">
                {index + 1}
              </span>
              <span className="pt-1 text-sm text-slate-200">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
          New projects start at 0 so the drawing only appears after the real job dimensions are entered.
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Start setup
          </Button>
        </div>
      </div>
    </div>
  );
}
