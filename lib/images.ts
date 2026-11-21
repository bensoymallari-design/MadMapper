export interface PreparedImage {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_EDGE = 1400;

export function prepareImageFile(file: File) {
  return new Promise<PreparedImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height, 1));
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to prepare that image."));
          return;
        }
        ctx.drawImage(source, 0, 0, width, height);
        const png = file.type === "image/png" && file.size < 700_000;
        resolve({
          name: file.name.replace(/\.[^.]+$/, "") || "Image",
          dataUrl: png ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82),
          width,
          height
        });
      };
      source.onerror = () => reject(new Error("That file is not a supported image."));
      source.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}
