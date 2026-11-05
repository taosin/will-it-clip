import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const destination = fileURLToPath(new URL("../public/ocr/", import.meta.url));
const packageDir = (name) => dirname(require.resolve(`${name}/package.json`));
const engine = packageDir("tesseract.js");
const core = dirname(
  createRequire(join(engine, "package.json")).resolve(
    "tesseract.js-core/package.json",
  ),
);

await mkdir(destination, { recursive: true });
await copyFile(
  join(engine, "dist/worker.min.js"),
  join(destination, "worker.min.js"),
);
await copyFile(
  join(engine, "dist/worker.min.js.LICENSE.txt"),
  join(destination, "worker.min.js.LICENSE.txt"),
);
await copyFile(
  join(engine, "LICENSE.md"),
  join(destination, "LICENSE-tesseract.txt"),
);
await copyFile(join(core, "LICENSE"), join(destination, "LICENSE-core.txt"));

// The v7 browser loader selects one of these self-contained JS/Wasm builds at runtime.
for (const variant of ["", "-simd", "-relaxedsimd"]) {
  const filename = `tesseract-core${variant}-lstm.wasm.js`;
  await copyFile(join(core, filename), join(destination, filename));
}

const credits = [
  "OCR runtime: https://github.com/naptha/tesseract.js (Apache-2.0)",
  "OCR core: https://github.com/naptha/tesseract.js-core (Apache-2.0)",
  "Language models: https://github.com/tesseract-ocr/tessdata_best (Apache-2.0)",
];
for (const lang of ["eng", "deu"]) {
  const dir = packageDir(`@tesseract.js-data/${lang}`);
  const filename = `${lang}.traineddata.gz`;
  await copyFile(
    join(dir, "4.0.0_best_int", filename),
    join(destination, filename),
  );
  const manifest = JSON.parse(
    await readFile(join(dir, "package.json"), "utf8"),
  );
  credits.push(
    `${manifest.name}@${manifest.version}: ${manifest.repository.url} (${manifest.license})`,
  );
}
await writeFile(join(destination, "NOTICE.txt"), credits.join("\n") + "\n");
