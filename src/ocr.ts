import type { Page } from "tesseract.js";

export type ScanLine = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type Action = "load" | "loadLanguage" | "initialize" | "recognize" | "FS";

type Engine = { worker: Worker; language: string; ready: boolean };
let engine: Engine | undefined;
let cancelActive: (() => void) | undefined;
const emptyPng =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFElEQVR4nGP4TyJgGNUwqmH4agAAr639H708R/EAAAAASUVORK5CYII=";

export function createScan(
  language: "eng" | "deu",
  onProgress: (progress: number) => void,
) {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  const assets = new URL("ocr/", base);
  let currentEngine: Engine | undefined;
  let running = false;
  let rejectPending: ((reason: Error) => void) | undefined;
  let used = false;
  let cancelled = false;

  function cancel() {
    cancelled = true;
    if (running) {
      currentEngine?.worker.terminate();
      if (engine === currentEngine) engine = undefined;
      rejectPending?.(new DOMException("Scan cancelled.", "AbortError"));
    }
  }

  // Use the pinned v7 worker protocol to own the Worker from the first request.
  // createWorker() only exposes terminate() after Wasm and the model finish loading.
  async function runStep<T>(
    action: Action,
    payload: object,
    transfer: Transferable[] = [],
  ): Promise<T> {
    if (cancelled || !currentEngine)
      throw new DOMException("Scan cancelled.", "AbortError");
    const active = currentEngine.worker;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        rejectPending = reject;
        timer = setTimeout(
          () =>
            reject(new Error("The recognition engine timed out. Try again.")),
          120_000,
        );
        active.onerror = () =>
          reject(new Error("The local recognition engine could not run."));
        active.onmessageerror = () =>
          reject(
            new Error("The local recognition engine returned unreadable data."),
          );
        active.onmessage = ({ data }) => {
          if (cancelled || data.action !== action) return;
          if (data.status === "resolve") resolve(data.data);
          if (data.status === "reject")
            reject(
              new Error(`The recognition engine failed during ${action}.`),
            );
          if (data.status === "progress" && action === "recognize") {
            onProgress(Math.max(0, Math.min(1, data.data.progress)));
          }
        };
        active.postMessage(
          { workerId: "local", jobId: action, action, payload },
          transfer,
        );
      });
    } finally {
      clearTimeout(timer);
      rejectPending = undefined;
      active.onmessage = null;
      active.onerror = null;
      active.onmessageerror = null;
    }
  }

  async function recognize(image: Blob): Promise<ScanLine[]> {
    if (cancelled) throw new DOMException("Scan cancelled.", "AbortError");
    if (used) throw new Error("Start a new scan for another screenshot.");
    used = true;
    cancelActive?.();
    cancelActive = cancel;
    running = true;
    if (engine && engine.language !== language) {
      engine.worker.terminate();
      engine = undefined;
    }
    try {
      currentEngine = engine ?? {
        worker: new Worker(new URL("worker.min.js", assets)),
        language,
        ready: false,
      };
      engine = currentEngine;
      if (!currentEngine.ready) {
        await runStep("load", {
          options: { lstmOnly: true, corePath: assets.href },
        });
        await runStep("loadLanguage", {
          langs: language,
          options: {
            langPath: assets.href,
            gzip: true,
            lstmOnly: true,
            cacheMethod: "none",
          },
        });
        await runStep("initialize", { langs: language, oem: 1 });
        currentEngine.ready = true;
      }
      const bytes = await image.arrayBuffer();
      const page = await runStep<Page>(
        "recognize",
        {
          image: new Uint8Array(bytes),
          options: { tessedit_pageseg_mode: "11", user_defined_dpi: "300" },
          output: { blocks: true, text: true },
        },
        [bytes],
      );
      const lines = (page.blocks ?? [])
        .flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.map((line) => ({
              text: line.text.trim(),
              confidence: line.confidence,
              bbox: line.bbox,
            })),
          ),
        )
        .filter((line) => line.text.length > 0);
      // Keep only static model resources between jobs, not the last screenshot.
      const empty = Uint8Array.from(atob(emptyPng), (byte) =>
        byte.charCodeAt(0),
      );
      await runStep(
        "recognize",
        {
          image: empty,
          options: {},
          output: { text: false, blocks: false },
        },
        [empty.buffer],
      );
      await runStep("FS", { method: "unlink", args: ["/input"] });
      return lines;
    } catch (error) {
      currentEngine?.worker.terminate();
      if (engine === currentEngine) engine = undefined;
      throw error;
    } finally {
      running = false;
      if (cancelActive === cancel) cancelActive = undefined;
    }
  }

  return { recognize, cancel };
}
