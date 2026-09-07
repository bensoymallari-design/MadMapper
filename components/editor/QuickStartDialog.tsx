"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuickSetupForm } from "@/components/editor/QuickSetupForm";

interface QuickStartDialogProps {
  open: boolean;
  onClose: () => void;
}

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

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <QuickSetupForm />
        </div>

        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
          Values entered here immediately update the left side menu and canvas calculations.
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
