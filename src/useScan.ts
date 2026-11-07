import { useContext, useEffect, useRef } from "react";
import { SessionMemory, useImageState } from "./SessionState";
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
type Phase = "idle" | "ready" | "cancelled" | "reading" | "complete" | "error";

export function useScan() {
  const memory = useContext(SessionMemory)!;
  const generation = useRef(0);
  const active = useRef<ReturnType<typeof createScan> | null>(null);
  const [picture, setPicture] = useImageState<Picture | null>(
    "scan-picture",
    null,
  );
  const [phase, setPhase] = useImageState<Phase>("scan-phase", "idle");
  const [error, setError] = useImageState("scan-error", "");
  const [progress, setProgress] = useImageState("scan-progress", 0);
  const [lines, setLines] = useImageState<ScanLine[]>("scan-lines", []);
  const [last, setLast] = useImageState<Source | null>("scan-last", null);

  const imageUrl = useRef(picture?.url ?? "");

  useEffect(
    () => () => {
      generation.current++;
      active.current?.cancel();
      if (memory.get("scan-phase") === "reading") setPhase("cancelled");
    },
    [],
  );

  function cancel() {
    generation.current++;
    active.current?.cancel();
    active.current = null;
    setPhase("cancelled");
  }

  function invalidate() {
    generation.current++;
    active.current?.cancel();
    active.current = null;
    setPhase(picture ? "ready" : "idle");
    setLines([]);
    setError("");
    setProgress(0);
  }

  async function run(source: Source, language: Language) {
    generation.current++;
    active.current?.cancel();
    active.current = null;
    setLines([]);
    setError("");
    setProgress(0);
    const id = generation.current;
    const current = () => generation.current === id;
    setPhase("reading");
    setLast(source);
    let inspected = picture;
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
      if (!picture || source !== last) {
        const dims = await pngDimensions(file);
        if (!current()) return;
        const url = URL.createObjectURL(file);
        const image = new Image();
        try {
          image.src = url;
          await image.decode();
          if (!current()) {
            URL.revokeObjectURL(url);
            return;
          }
          if (
            image.naturalWidth !== dims.width ||
            image.naturalHeight !== dims.height
          )
            throw new Error("The PNG dimensions could not be verified.");
          if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
          imageUrl.current = url;
          inspected = { url, name: source.name, ...dims };
          setPicture(inspected);
        } catch (error) {
          URL.revokeObjectURL(url);
          throw error;
        } finally {
          image.src = "";
        }
      }
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
      return inspected;
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
  return {
    picture,
    phase,
    error,
    progress,
    lines,
    last,
    run,
    cancel,
    invalidate,
  };
}
