"use client";

import { Download, FilePlus2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useEditorStore } from "@/store/editorStore";

export function ProjectManager() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { newProject, exportProjectJson, importProject } = useEditorStore();

  function downloadJson() {
    const blob = new Blob([exportProjectJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "led-wall-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    importProject(await file.text());
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Project Files</h2>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" size="sm" onClick={newProject}>
          <FilePlus2 className="h-4 w-4" />
          New
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadJson}>
          <Download className="h-4 w-4" />
          JSON
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
