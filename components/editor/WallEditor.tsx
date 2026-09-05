"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { ColorLegend } from "@/components/editor/ColorLegend";
import { ExportDialog } from "@/components/editor/export/ExportDialog";
import { ProjectManager } from "@/components/editor/ProjectManager";
import { StatusBar } from "@/components/editor/StatusBar";
import { WallCanvas } from "@/components/editor/WallCanvas";
import { MappingSettingsPanel } from "@/components/editor/panels/MappingSettings";
import { ModuleSettingsPanel } from "@/components/editor/panels/ModuleSettings";
import { WallSettingsPanel } from "@/components/editor/panels/WallSettings";
import { useEditorStore } from "@/store/editorStore";

export function WallEditor() {
  const [exportOpen, setExportOpen] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const {
    importProject,
    saveLocal,
    loadLocal,
    undo,
    redo,
    selectAll,
    clearSelection,
    updateSelectedModules,
    setView,
    view
  } = useEditorStore();

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveLocal();
      } else if (modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        importRef.current?.click();
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      } else if (event.key === "Escape") {
        clearSelection();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        updateSelectedModules({ enabled: false, status: "unused" });
      } else if (event.key === "*" || event.key === "+") {
        setView({ zoom: Math.min(2.5, view.zoom * 1.15) });
      } else if (event.key === "-") {
        setView({ zoom: Math.max(0.015, view.zoom * 0.85) });
      } else if (event.key.toLowerCase() === "f") {
        window.dispatchEvent(new Event("led-wall-fit"));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, redo, saveLocal, selectAll, setView, undo, updateSelectedModules, view.zoom]);

  async function handleImport(file: File) {
    try {
      importProject(await file.text());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to import project.");
    }
  }

  return (
    <main className="technical-grid flex h-screen min-h-0 flex-col gap-3 p-3 text-slate-100">
      <CanvasToolbar onOpenExport={() => setExportOpen(true)} onImport={() => importRef.current?.click()} />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_340px] gap-3">
        <aside className="panel min-h-0 overflow-y-auto rounded-xl p-4">
          <div className="space-y-5">
            <ProjectManager />
            <WallSettingsPanel />
            <MappingSettingsPanel />
            <ColorLegend />
          </div>
        </aside>
        <section className="min-h-0">
          <WallCanvas />
        </section>
        <aside className="panel min-h-0 overflow-y-auto rounded-xl p-4">
          <ModuleSettingsPanel />
        </aside>
      </div>
      <StatusBar />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.currentTarget.value = "";
        }}
      />
    </main>
  );
}
