export type Region = { x: number; y: number; width: number; height: number };

export function cropGeometry(region: Region, width: number, height: number) {
  if (
    ![width, height, region.x, region.y, region.width, region.height].every(
      Number.isFinite,
    ) ||
    region.width <= 0 ||
    region.height <= 0
  ) {
    throw new Error("Choose an area that contains a full label.");
  }
  const left = Math.max(0, Math.floor(region.x));
  const top = Math.max(0, Math.floor(region.y));
  const right = Math.min(width, Math.ceil(region.x + region.width));
  const bottom = Math.min(height, Math.ceil(region.y + region.height));
  if (right - left < 8 || bottom - top < 8)
    throw new Error("Choose a larger area around the label.");

  // A small margin keeps glyphs at a control edge visible to the recognizer.
  const x = Math.max(0, left - 6);
  const y = Math.max(0, top - 6);
  const w = Math.min(width, right + 6) - x;
  const h = Math.min(height, bottom + 6) - y;
  const scale = Math.min(
    2,
    8192 / Math.max(w, h),
    Math.sqrt(6_000_000 / (w * h)),
  );
  const outputWidth = Math.max(1, Math.floor(w * scale));
  const outputHeight = Math.max(1, Math.floor(h * scale));
  return { x, y, w, h, outputWidth, outputHeight, left, top, right, bottom };
}

export async function cropForRecognition(url: string, region: Region) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const g = cropGeometry(region, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = g.outputWidth;
  canvas.height = g.outputHeight;
  try {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Your browser could not open a drawing surface.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      g.x,
      g.y,
      g.w,
      g.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not read the selected area.")),
        "image/png",
      ),
    );
    return { blob, geometry: g };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
