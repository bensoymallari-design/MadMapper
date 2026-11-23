"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { ColorLegend } from "@/components/editor/ColorLegend";
import { CollapsiblePanel } from "@/components/editor/CollapsiblePanel";
import { ExportDialog } from "@/components/editor/export/ExportDialog";
import { ProjectManager } from "@/components/editor/ProjectManager";
import { StatusBar } from "@/components/editor/StatusBar";
import { WallCanvas } from "@/components/editor/WallCanvas";
import { AnnotationSettings } from "@/components/editor/panels/AnnotationSettings";
import { SheetSettingsPanel } from "@/components/editor/panels/SheetSettings";
import { MappingSettingsPanel } from "@/components/editor/panels/MappingSettings";
import { ModuleSettingsPanel } from "@/components/editor/panels/ModuleSettings";
import { WallSettingsPanel } from "@/components/editor/panels/WallSettings";
import { QuickStartDialog } from "@/components/editor/QuickStartDialog";
import { useEditorStore } from "@/store/editorStore";

export function WallEditor() {
  const [exportOpen, setExportOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(true);
  const importRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLElement | null>(null);
  const {
    importProject,
    saveLocal,
    undo,
    redo,
    selectAll,
    clearSelection,
    updateSelectedModules,
    setView,
    view
  } = useEditorStore();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
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
        useEditorStore.getState().selectAnnotation(null);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        const state = useEditorStore.getState();
        if (state.selectedAnnotationId) {
          event.preventDefault();
          state.deleteSelectedAnnotation();
          return;
        }
        if (state.selectedImageId) {
          event.preventDefault();
          state.deleteImage(state.selectedImageId);
          return;
        }
        if (state.selectedModuleIds.length > 0) {
          updateSelectedModules({ enabled: false, status: "unused" });
          return;
        }
        if (state.selectedPlacedId) {
          event.preventDefault();
          state.deletePlacedProject(state.selectedPlacedId);
          return;
        }
        updateSelectedModules({ enabled: false, status: "unused" });
      } else if (event.key === "*" || event.key === "+" || (modifier && event.key === "=")) {
        event.preventDefault();
        setView({ zoom: Math.min(2.5, view.zoom * 1.15) });
      } else if (event.key === "-") {
        event.preventDefault();
        setView({ zoom: Math.max(0.015, view.zoom * 0.85) });
      } else if (event.key.toLowerCase() === "f") {
        window.dispatchEvent(new Event("led-wall-fit"));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, redo, saveLocal, selectAll, setView, undo, updateSelectedModules, view.zoom]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    function preventBrowserZoom(event: WheelEvent) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    }

    editor.addEventListener("wheel", preventBrowserZoom, { passive: false, capture: true });
    return () => editor.removeEventListener("wheel", preventBrowserZoom, { capture: true });
  }, []);

  async function handleImport(file: File) {
    try {
      importProject(await file.text());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to import project.");
    }
  }

  return (
    <main ref={editorRef} className="technical-grid flex h-screen min-h-0 flex-col gap-3 p-3 text-slate-100">
      <CanvasToolbar onOpenExport={() => setExportOpen(true)} onImport={() => importRef.current?.click()} />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_340px] gap-3">
        <aside className="panel min-h-0 overflow-y-auto rounded-xl p-4">
          <div className="space-y-3">
            <section className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Quick Setup</div>
              <p className="mb-3 text-xs text-slate-400">Open the guided setup popup for module, wall, cabinet, and pixel values.</p>
              <Button className="w-full" variant="primary" onClick={() => setQuickStartOpen(true)}>
                Open Quick Setup
              </Button>
            </section>
            <CollapsiblePanel title="Project Files" description="New, open, export JSON" defaultOpen>
              <ProjectManager />
            </CollapsiblePanel>
            <CollapsiblePanel title="Pages, Projects & Images" description="PDF borders, extra walls, pictures" defaultOpen>
              <SheetSettingsPanel />
            </CollapsiblePanel>
            <CollapsiblePanel title="Wall & Modules" description="Dimensions, pixels, calculated layout" defaultOpen>
              <WallSettingsPanel />
            </CollapsiblePanel>
            <CollapsiblePanel title="Mapping, Cabinets & Power" description="Signal routes, AC loops, layers">
              <MappingSettingsPanel />
            </CollapsiblePanel>
            <CollapsiblePanel title="Color Legend" description="Port and status colors">
              <ColorLegend />
            </CollapsiblePanel>
          </div>
        </aside>
        <section className="min-h-0">
          <WallCanvas />
        </section>
        <aside className="panel min-h-0 overflow-y-auto rounded-xl p-4">
          <div className="space-y-4">
            <AnnotationSettings />
            <ModuleSettingsPanel />
          </div>
        </aside>
      </div>
      <StatusBar />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <QuickStartDialog open={quickStartOpen} onClose={() => setQuickStartOpen(false)} />
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
