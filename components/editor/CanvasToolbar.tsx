"use client";

import {
  BoxSelect,
  Eraser,
  FileDown,
  FolderOpen,
  Grid3X3,
  Hand,
  Map,
  Maximize,
  Minus,
  MousePointer2,
  Redo2,
  Route,
  Save,
  Settings2,
  Undo2,
  ZoomIn
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEditorStore } from "@/store/editorStore";
import type { ToolMode } from "@/types/project";

interface CanvasToolbarProps {
  onOpenExport: () => void;
  onImport: () => void;
}

const tools: { id: ToolMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "color", label: "Color", icon: BoxSelect },
  { id: "mapping", label: "Port Mapping", icon: Route },
  { id: "cabinet", label: "Cabinet", icon: Grid3X3 },
  { id: "measure", label: "Measure", icon: Map },
  { id: "dimension", label: "Dimension", icon: Settings2 }
];

export function CanvasToolbar({ onOpenExport, onImport }: CanvasToolbarProps) {
  const {
    project,
    activeTool,
    view,
    setActiveTool,
    setView,
    undo,
    redo,
    saveLocal,
    updateSelectedModules,
    selectedModuleIds
  } = useEditorStore();

  return (
    <header className="panel flex h-16 items-center justify-between gap-4 rounded-xl px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15">
          <Grid3X3 className="h-5 w-5 text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-sky-50">LED WALL MAPPER</div>
          <div className="truncate text-xs text-slate-400">{project.projectName}</div>
        </div>
      </div>

      <div className="hidden items-center gap-1 xl:flex">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              title={tool.label}
              variant={activeTool === tool.id ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveTool(tool.id)}
            >
              <Icon className="h-4 w-4" />
              {tool.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <Button title="Undo (Ctrl/Cmd+Z)" size="icon" variant="ghost" onClick={undo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button title="Redo (Ctrl/Cmd+Shift+Z)" size="icon" variant="ghost" onClick={redo}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button title="Zoom out (-)" size="icon" variant="ghost" onClick={() => setView({ zoom: Math.max(0.015, view.zoom * 0.85) })}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button title="Zoom in (*)" size="icon" variant="ghost" onClick={() => setView({ zoom: Math.min(2.5, view.zoom * 1.15) })}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button title="Fit wall (F)" size="icon" variant="ghost" onClick={() => window.dispatchEvent(new Event("led-wall-fit"))}>
          <Maximize className="h-4 w-4" />
        </Button>
        <Button title="Open JSON (Ctrl/Cmd+O)" size="icon" variant="ghost" onClick={onImport}>
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button title="Save locally (Ctrl/Cmd+S)" size="icon" variant="ghost" onClick={saveLocal}>
          <Save className="h-4 w-4" />
        </Button>
        <Button
          title="Disable selected modules (Delete)"
          size="icon"
          variant="ghost"
          disabled={selectedModuleIds.length === 0}
          onClick={() => updateSelectedModules({ enabled: false, status: "unused" })}
        >
          <Eraser className="h-4 w-4" />
        </Button>
        <Button variant="primary" onClick={onOpenExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>
      </div>
    </header>
  );
}
