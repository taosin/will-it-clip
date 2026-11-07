import { useContext, useEffect, useRef } from "react";
import { SessionMemory, useImageState } from "./SessionState";
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
function compareReading(reading: Result, expected: string) {
  return reading.reliable ? compareText(reading.text, expected) : "unknown";
}

type Phase =
  "idle" | "selecting" | "cancelled" | "reading" | "complete" | "error";

export function useRegionScan() {
  const memory = useContext(SessionMemory)!;
  const [decision, setDecision] = useImageState<HumanDecision>(
    "area-decision",
    "Unreviewed",
  );
  const [phase, setPhase] = useImageState<Phase>("area-phase", "idle");
  const [region, setRegion] = useImageState<Region | null>("area-region", null);
  const [result, setResult] = useImageState<Result | null>("area-result", null);
  const [error, setError] = useImageState("area-error", "");
  const [expected, editExpected] = useImageState("area-expected", "");
  const [verdict, setVerdict] = useImageState<ReturnType<
    typeof compareText
  > | null>("area-verdict", null);
  const generation = useRef(0);
  const worker = useRef<ReturnType<typeof createScan> | null>(null);
  const objectUrl = useRef(result?.preview ?? "");

  function dispose() {
    generation.current++;
    worker.current?.cancel();
    worker.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
  }
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.cancel();
      if (memory.get("area-phase") === "reading") setPhase("cancelled");
    },
    [],
  );
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
  function cancel() {
    generation.current++;
    worker.current?.cancel();
    worker.current = null;
    setPhase("cancelled");
  }
  function begin() {
    clear();
    setPhase("selecting");
  }
  async function read(
    picture: Picture,
    language: Language,
    area: Region,
    reference = "",
  ) {
    clear();
    const id = generation.current;
    setRegion(area);
    editExpected(reference);
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
      const reading = {
        preview: objectUrl.current,
        lines: selected,
        text: selected.map((l) => l.text).join("\n"),
        reliable:
          selected.length > 0 &&
          withMargin &&
          selected.every((l) => l.confidence >= 80),
      };
      setResult(reading);
      if (reference.trim()) setVerdict(compareReading(reading, reference));
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
    setVerdict(compareReading(result, expected));
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
    cancel,
    begin,
    read,
    setExpected,
    compare,
  };
}
