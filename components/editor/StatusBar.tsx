"use client";

import { calculateLayoutMetrics } from "@/lib/calculations";
import { useEditorStore } from "@/store/editorStore";

export function StatusBar() {
  const { project, selectedModuleIds, view } = useEditorStore();
  const metrics = calculateLayoutMetrics(project.wall, project.module, project.modules);

  return (
    <footer className="panel flex h-11 items-center gap-5 overflow-x-auto rounded-xl px-4 text-xs text-slate-300">
      <Status label="Wall" value={`${project.wall.width} x ${project.wall.height} ${project.wall.unit}`} />
      <Status label="Module" value={`${project.module.width} x ${project.module.height} ${project.wall.unit}`} />
      <Status label="Modules" value={`${metrics.columns} x ${metrics.rows} (${metrics.totalModules})`} />
      <Status label="Active" value={`${metrics.activeModules}`} />
      <Status label="Resolution" value={`${metrics.wallPixelWidth} x ${metrics.wallPixelHeight} px`} />
      <Status label="Zoom" value={`${Math.round(view.zoom * 100)}%`} />
      <Status label="Selected" value={`${selectedModuleIds.length}`} />
    </footer>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}
