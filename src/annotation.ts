import type { Region } from "./region";

export type HumanDecision = "Unreviewed" | "Confirmed" | "Expected behavior";

export function exportGeometry(
  region: Region,
  width: number,
  height: number,
  full: boolean,
) {
  if (
    ![width, height, region.x, region.y, region.width, region.height].every(
      Number.isFinite,
    ) ||
    width <= 0 ||
    height <= 0 ||
    region.width <= 0 ||
    region.height <= 0
  )
    throw new Error("The selected area is invalid.");
  const left = Math.max(0, Math.floor(region.x));
  const top = Math.max(0, Math.floor(region.y));
  const right = Math.min(width, Math.ceil(region.x + region.width));
  const bottom = Math.min(height, Math.ceil(region.y + region.height));
  if (right <= left || bottom <= top)
    throw new Error("The selected area is outside the screenshot.");
  const crop = full
    ? { x: 0, y: 0, width, height }
    : {
        x: Math.max(0, left - 24),
        y: Math.max(0, top - 24),
        width: Math.min(width, right + 24) - Math.max(0, left - 24),
        height: Math.min(height, bottom + 24) - Math.max(0, top - 24),
      };
  const scale = Math.min(1, 1400 / Math.max(crop.width, crop.height));
  return {
    crop,
    left,
    top,
    right,
    bottom,
    scale,
    imageWidth: Math.max(1, Math.ceil(crop.width * scale)),
    imageHeight: Math.max(1, Math.ceil(crop.height * scale)),
    width: Math.max(560, Math.ceil(crop.width * scale) + 40),
  };
}

export function wrapAnnotation(
  text: string,
  width: number,
  measure: (text: string) => number,
  maxLines = 20,
) {
  const output: string[] = [];
  let line = "";
  let truncated = text.length > 4000;
  for (const char of Array.from(text.slice(0, 4000))) {
    if (char === "\n" || (line && measure(line + char) > width)) {
      output.push(line.trimEnd());
      line = "";
      if (output.length >= maxLines) {
        truncated = true;
        break;
      }
      if (char === "\n") continue;
    }
    line += char;
  }
  if (output.length < maxLines) output.push(line.trimEnd());
  if (truncated) {
    let last = output.at(-1) ?? "";
    while (last && measure(last + "…") > width)
      last = Array.from(last).slice(0, -1).join("");
    output[output.length - 1] = last + "…";
  }
  return output;
}

export async function renderAnnotation(
  input: {
    url: string;
    width: number;
    height: number;
    region: Region;
    recognized: string;
    expected: string;
    machine: string;
    decision: HumanDecision;
    full: boolean;
  },
  signal: AbortSignal,
) {
  const image = new Image();
  image.src = input.url;
  await image.decode();
  signal.throwIfAborted();
  const g = exportGeometry(input.region, input.width, input.height, input.full);
  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create the PNG.");
    context.font = "16px sans-serif";
    const paragraphs = [
      "Will It Clip? · " +
        (input.full ? "Full screenshot" : "Selected area with context"),
      "Recognized text: " + (input.recognized || "No readable text found."),
      ...(input.expected.trim() ? ["Expected text: " + input.expected] : []),
      "Machine evidence: " + input.machine,
      "Human decision: " + input.decision,
    ].map((text) =>
      wrapAnnotation(text, g.width - 40, (t) => context.measureText(t).width),
    );
    canvas.width = g.width;
    canvas.height =
      g.imageHeight +
      60 +
      paragraphs.reduce((sum, lines) => sum + lines.length * 24 + 12, 0);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      g.crop.x,
      g.crop.y,
      g.crop.width,
      g.crop.height,
      20,
      20,
      g.imageWidth,
      g.imageHeight,
    );
    context.strokeStyle = "#a84d00";
    context.lineWidth = 3;
    context.strokeRect(
      20 + (g.left - g.crop.x) * g.scale,
      20 + (g.top - g.crop.y) * g.scale,
      (g.right - g.left) * g.scale,
      (g.bottom - g.top) * g.scale,
    );
    context.font = "16px sans-serif";
    context.fillStyle = "#192f29";
    let y = g.imageHeight + 54;
    for (const lines of paragraphs) {
      for (const line of lines) {
        context.fillText(line, 20, y);
        y += 24;
      }
      y += 12;
    }
    signal.throwIfAborted();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Could not encode the PNG.")),
        "image/png",
      ),
    );
    signal.throwIfAborted();
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
