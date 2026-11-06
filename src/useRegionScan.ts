import { useEffect, useRef, useState } from "react";
import { cropForRecognition, type Region } from "./region";
import type { createScan, ScanLine } from "./ocr";
import type { Picture, Language } from "./useScan";
import type { HumanDecision } from "./annotation";
import { compareText } from "./review";

type Result = {
  preview: string;
  text: string;
  lines: ScanLine[];
  reliable: boolean;
};
type Phase = "idle" | "selecting" | "reading" | "complete" | "error";

export function useRegionScan() {
  const [decision, setDecision] = useState<HumanDecision>("Unreviewed");
  const [phase, setPhase] = useState<Phase>("idle");
  const [region, setRegion] = useState<Region | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [expected, editExpected] = useState("");
  const [verdict, setVerdict] = useState<ReturnType<typeof compareText> | null>(
    null,
  );
  const generation = useRef(0);
  const worker = useRef<ReturnType<typeof createScan> | null>(null);
  const objectUrl = useRef("");

  function dispose() {
    generation.current++;
    worker.current?.cancel();
    worker.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
  }
  useEffect(() => dispose, []);
  function clear() {
    dispose();
    setRegion(null);
    setPhase("idle");
    setResult(null);
    editExpected("");
    setDecision("Unreviewed");
    setVerdict(null);
    setError("");
  }
  function begin() {
    clear();
    setPhase("selecting");
  }
  async function read(picture: Picture, language: Language, area: Region) {
    clear();
    const id = generation.current;
    setRegion(area);
    setPhase("reading");
    let task: ReturnType<typeof createScan> | undefined;
    try {
      const { blob, geometry: g } = await cropForRecognition(picture.url, area);
      if (id !== generation.current) return;
      const { createScan } = await import("./ocr");
      if (id !== generation.current) return;
      task = createScan(language, () => {});
      worker.current = task;
      const lines = await task.recognize(blob);
      if (id !== generation.current) return;
      const selected = lines
        .map((line) => {
          const { x0, y0, x1, y1 } = line.bbox;
          return {
            ...line,
            bbox: {
              x0: g.x + (x0 * g.w) / g.outputWidth,
              y0: g.y + (y0 * g.h) / g.outputHeight,
              x1: g.x + (x1 * g.w) / g.outputWidth,
              y1: g.y + (y1 * g.h) / g.outputHeight,
            },
          };
        })
        .filter(({ bbox }) => {
          const midX = (bbox.x0 + bbox.x1) / 2,
            midY = (bbox.y0 + bbox.y1) / 2;
          return (
            midX >= g.left && midX < g.right && midY >= g.top && midY < g.bottom
          );
        });
      const withMargin = selected.every(
        ({ bbox }) =>
          bbox.x0 > g.left &&
          bbox.y0 > g.top &&
          bbox.x1 < g.right &&
          bbox.y1 < g.bottom,
      );
      objectUrl.current = URL.createObjectURL(blob);
      setResult({
        preview: objectUrl.current,
        lines: selected,
        text: selected.map((l) => l.text).join("\n"),
        reliable:
          selected.length > 0 &&
          withMargin &&
          selected.every((l) => l.confidence >= 80),
      });
      setPhase("complete");
    } catch (e) {
      if (id !== generation.current) return;
      setError(e instanceof Error ? e.message : "Could not read this area.");
      setPhase("error");
    } finally {
      task?.cancel();
      if (worker.current === task) worker.current = null;
    }
  }
  function setExpected(value: string) {
    editExpected(value);
    setDecision("Unreviewed");
    setVerdict(null);
  }
  function compare() {
    if (!result || !expected.trim()) return;
    setVerdict(
      result.reliable ? compareText(result.text, expected) : "unknown",
    );
  }
  return {
    phase,
    decision,
    setDecision,
    region,
    result,
    error,
    expected,
    verdict,
    clear,
    begin,
    read,
    setExpected,
    compare,
  };
}
