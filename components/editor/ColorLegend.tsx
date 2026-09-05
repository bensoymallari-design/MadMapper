"use client";

import { useEditorStore } from "@/store/editorStore";

export function ColorLegend() {
  const { project } = useEditorStore();

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Color Legend</h2>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <div className="font-semibold text-slate-400">Ports</div>
          {Object.entries(project.legend.ports)
            .slice(0, project.mapping.portCount)
            .map(([port, color]) => (
              <div key={port} className="flex items-center justify-between gap-2 text-slate-300">
                <span>Port {port}</span>
                <span className="h-4 w-4 rounded border border-white/20" style={{ backgroundColor: color }} />
              </div>
            ))}
        </div>
        <div className="space-y-2">
          <div className="font-semibold text-slate-400">Status</div>
          {Object.entries(project.legend.statuses).map(([status, color]) => (
            <div key={status} className="flex items-center justify-between gap-2 text-slate-300">
              <span className="capitalize">{status}</span>
              <span className="h-4 w-4 rounded border border-white/20" style={{ backgroundColor: color }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
