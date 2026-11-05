const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
export async function pngDimensions(file: Blob) {
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose a PNG smaller than 12 MiB.");
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  if (
    bytes.length < 24 ||
    pngHeader.some((n, i) => n !== bytes[i]) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  ) {
    throw new Error(
      "Choose a PNG screenshot. Other formats are not supported yet.",
    );
  }
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > 6_000_000
  ) {
    throw new Error(
      "Choose a PNG up to 6 megapixels and 8,192 pixels per side.",
    );
  }
  return { width, height };
}
