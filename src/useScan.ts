import { useEffect, useRef, useState } from "react";
import { pngDimensions } from "./input";
import type { createScan, ScanLine } from "./ocr";

export type Language = "eng" | "deu";
export type Source =
  { name: string; file: File } | { name: string; url: string };
export type Picture = {
  url: string;
  name: string;
  width: number;
  height: number;
};
type Phase = "idle" | "reading" | "complete" | "error";

export function useScan() {
  const generation = useRef(0);
  const active = useRef<ReturnType<typeof createScan> | null>(null);
  const imageUrl = useRef("");
  const [picture, setPicture] = useState<Picture | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [last, setLast] = useState<Source | null>(null);

  function dispose() {
    generation.current++;
    active.current?.cancel();
    active.current = null;
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = "";
  }
  useEffect(() => dispose, []);

  function reset() {
    dispose();
    setPhase("idle");
    setPicture(null);
    setLines([]);
    setLast(null);
    setError("");
    setProgress(0);
  }

  async function run(source: Source, language: Language) {
    reset();
    const id = generation.current;
    const current = () => generation.current === id;
    setPhase("reading");
    setLast(source);
    let task: ReturnType<typeof createScan> | undefined;
    try {
      let file: Blob;
      if ("file" in source) file = source.file;
      else {
        const response = await fetch(source.url);
        if (!response.ok)
          throw new Error("Could not open this example. Try again.");
        file = await response.blob();
      }
      const dims = await pngDimensions(file);
      if (!current()) return;
      const url = URL.createObjectURL(file);
      imageUrl.current = url;
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!current()) return;
      if (
        image.naturalWidth !== dims.width ||
        image.naturalHeight !== dims.height
      ) {
        throw new Error("The PNG dimensions could not be verified.");
      }
      setPicture({ url, name: source.name, ...dims });
      const { createScan } = await import("./ocr");
      if (!current()) return;
      task = createScan(language, (value) => {
        if (current()) setProgress(value);
      });
      active.current = task;
      const result = await task.recognize(file);
      if (!current()) return;
      setLines(result.filter((line) => line.text.trim()));
      setPhase("complete");
    } catch (e) {
      if (current()) {
        setError(
          e instanceof Error
            ? e.message
            : "Recognition failed. Please try again.",
        );
        setPhase("error");
      }
    } finally {
      task?.cancel();
      if (active.current === task) active.current = null;
    }
  }
  return { picture, phase, error, progress, lines, last, reset, run };
}
