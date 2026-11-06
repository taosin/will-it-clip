import { useRef, useState, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import { Icon } from "./Icon";
import { compareText, hasTrailingEllipsis, matchedCandidate } from "./review";
import { useScan, type Language } from "./useScan";
import { Screenshot } from "./Screenshot";
import { useRegionScan } from "./useRegionScan";
import { RegionReview } from "./RegionReview";
import { ReviewExport } from "./ReviewExport";
import type { HumanDecision } from "./annotation";
import "./style.css";

const examples = [
  {
    id: "clipped",
    title: "Clipped title",
    subtitle: "German",
    lang: "deu",
    sample: "Aa…",
  },
  {
    id: "wrapped",
    title: "Wrapped title",
    subtitle: "German",
    lang: "deu",
    sample: "Aa",
  },
  {
    id: "loading",
    title: "Intentional ellipsis",
    subtitle: "English",
    lang: "eng",
    sample: "…",
  },
] as const;
const assets = import.meta.env.BASE_URL;

function Inspector() {
  const scan = useScan();
  const area = useRegionScan();
  const [language, setLanguage] = useState<Language>("deu");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [notice, setNotice] = useState("");
  const [selected, select] = useState<number | null>(null);
  const [expectedByLine, setExpectedByLine] = useState<Record<number, string>>(
    {},
  );
  const [decisions, setDecisions] = useState<Record<number, HumanDecision>>({});
  const expected = selected === null ? "" : (expectedByLine[selected] ?? "");
  function setExpected(value: string) {
    if (selected === null) return;
    setExpectedByLine((previous) => ({ ...previous, [selected]: value }));
    setDecisions((previous) => ({ ...previous, [selected]: "Unreviewed" }));
    setJudgments((previous) => {
      const next = { ...previous };
      delete next[selected];
      return next;
    });
  }
  const [judgments, setJudgments] = useState<
    Record<number, { value: string; outcome: ReturnType<typeof compareText> }>
  >({});
  const input = useRef<HTMLInputElement>(null);
  const candidates = scan.lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => hasTrailingEllipsis(line.text));
  const resolved = new Set(
    candidates
      .filter(
        ({ i, line }) =>
          line.confidence >= 80 &&
          judgments[i]?.outcome === "complete" &&
          judgments[i].value === expectedByLine[i],
      )
      .map(({ i }) => i),
  );
  const resolvedArea =
    area.verdict === "complete" && area.region && area.result
      ? matchedCandidate(candidates, area.region, area.result.lines)
      : null;
  if (resolvedArea !== null) resolved.add(resolvedArea);
  const activeCandidates = candidates.filter(({ i }) => !resolved.has(i));
  const matching = resolved.size;

  function clearReview() {
    area.clear();
    select(null);
    setExpectedByLine({});
    setDecisions({});
    setJudgments({});
    setNotice("");
  }
  function openFiles(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1) {
      setNotice("Choose one screenshot at a time.");
      return;
    }
    const file = files[0];
    clearReview();
    void scan.run({ file, name: file.name }, language);
  }
  function example(id: (typeof examples)[number]["id"]) {
    const item = examples.find((e) => e.id === id)!;
    clearReview();
    setLanguage(item.lang);
    void scan.run(
      { name: item.id + ".png", url: assets + "examples/" + item.id + ".png" },
      item.lang,
    );
  }
  function dropped(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    openFiles(e.dataTransfer.files);
  }
  function chooseLine(i: number) {
    select(i);
  }
  function compare(i: number) {
    if (!expected.trim()) return;
    const outcome =
      scan.lines[i].confidence >= 80
        ? compareText(scan.lines[i].text, expected)
        : "unknown";
    setJudgments((previous) => ({
      ...previous,
      [i]: { value: expected, outcome },
    }));
  }
  const result = scan.phase === "complete";
  const working = scan.phase === "reading";
  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (
          e.dataTransfer.types.includes("Files") &&
          --dragDepth.current <= 0
        ) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={dropped}
    >
      <header className="bar">
        <div className="bar-inner">
          <a className="brand" href={assets} aria-label="Will It Clip? home">
            <img src={assets + "mark.svg"} width="32" height="32" alt="" />
            Will It Clip?
          </a>
          <div className="privacy">
            <Icon name="shield" size={16} /> Runs on your device
          </div>
        </div>
      </header>
      <main>
        <section className="intro">
          <h1>
            Screenshot inspector<span className="title-dot">.</span>
          </h1>
          <p>Spot cut-off text in localized app screenshots.</p>
        </section>
        <input
          type="file"
          ref={input}
          accept="image/png,.png"
          hidden
          onChange={(e) => {
            openFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="workbench">
          <section className="canvas-panel" aria-label="Screenshot preview">
            <header className="panel-bar">
              <strong>
                <Icon name="image" />
                Screenshot
              </strong>
              <div className="bar-actions">
                {!working && scan.picture && (
                  <button
                    type="button"
                    className="small-button"
                    data-region-select
                    aria-pressed={area.phase === "selecting"}
                    onClick={() => {
                      if (area.phase === "selecting") area.clear();
                      else area.begin();
                    }}
                  >
                    <Icon name="brackets" size={15} />
                    {area.phase === "selecting"
                      ? "Cancel selection"
                      : "Select area"}
                  </button>
                )}
                {scan.phase !== "idle" && (
                  <button
                    className="link-btn"
                    onClick={() => {
                      clearReview();
                      scan.reset();
                    }}
                  >
                    {working ? "Cancel" : "Clear"}
                  </button>
                )}
                <button
                  className="small-button"
                  onClick={() => input.current?.click()}
                >
                  <Icon name="upload" size={15} />
                  Open PNG
                </button>
              </div>
            </header>
            {scan.picture ? (
              <Screenshot
                picture={scan.picture}
                selecting={area.phase === "selecting"}
                region={area.region}
                onRegion={(region) => {
                  if (scan.picture)
                    void area.read(scan.picture, language, region);
                }}
                onCancelSelect={area.clear}
                candidates={activeCandidates}
                selected={selected}
                onSelect={chooseLine}
              />
            ) : (
              <div className="drop-surface">
                <div className="crop-art" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <span>
                    Aa<span className="ink-dots">…</span>
                  </span>
                </div>
                <h2>
                  {working ? "Opening screenshot…" : "Drop a screenshot here"}
                </h2>
                <p>PNG · up to 12 MiB · 6 megapixels</p>
                {!working && (
                  <button
                    className="primary"
                    onClick={() => input.current?.click()}
                  >
                    Choose screenshot <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
            )}
            {scan.picture && (
              <div className="file-meta">
                <span>{scan.picture.name}</span>
                <span>
                  {scan.picture.width} × {scan.picture.height} px
                </span>
              </div>
            )}
          </section>

          <aside className="sidebar">
            <section className="settings">
              <label htmlFor="locale">Text language</label>
              <select
                id="locale"
                value={language}
                onChange={(e) => {
                  const lang = e.target.value as Language;
                  setLanguage(lang);
                  if (scan.last) {
                    clearReview();
                    void scan.run(scan.last, lang);
                  }
                }}
              >
                <option value="eng">English</option>
                <option value="deu">German</option>
              </select>
            </section>
            <RegionReview
              scan={area}
              picture={scan.picture}
              language={language}
              retry={() => {
                if (scan.picture && area.region)
                  void area.read(scan.picture, language, area.region);
              }}
            />
            <section
              className="analysis"
              data-status={scan.phase}
              aria-label="Review results"
            >
              <div className="section-heading">
                <Icon name="scan" size={18} />
                <h2>Inspection</h2>
                {result && (
                  <span className="counter">{activeCandidates.length}</span>
                )}
              </div>
              <div role="status" aria-live="polite">
                {scan.phase === "idle" && (
                  <p className="muted">
                    Open a PNG or try an example to inspect its text.
                  </p>
                )}
                {working && (
                  <>
                    <p className="reading">
                      {scan.progress > 0
                        ? "Reading text…"
                        : "Preparing local recognition…"}
                    </p>
                    <progress max={1} value={scan.progress || undefined} />
                  </>
                )}
                {scan.phase === "error" && (
                  <>
                    <p className="error">{scan.error}</p>
                    {scan.last && (
                      <button
                        className="small-button"
                        onClick={() => {
                          clearReview();
                          void scan.run(scan.last!, language);
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </>
                )}
                {result && (
                  <p
                    className={
                      activeCandidates.length
                        ? "result-caption"
                        : "success-note"
                    }
                  >
                    {!scan.lines.length
                      ? "No readable text found. Try a clearer screenshot."
                      : activeCandidates.length
                        ? "Review the highlighted text."
                        : matching
                          ? "The punctuation matches your expected text."
                          : "Full-image scan found no trailing ellipsis. Select an area to check a label more closely."}
                  </p>
                )}
              </div>
              {candidates.map(({ i, line }) => (
                <div
                  key={i}
                  className={
                    "finding " +
                    (selected === i ? "active " : "") +
                    (resolved.has(i) ? "resolved" : "")
                  }
                  data-machine-resolved={resolved.has(i)}
                  data-candidate
                >
                  <button
                    className="finding-pick"
                    onClick={() => chooseLine(i)}
                    aria-expanded={selected === i}
                  >
                    <small>
                      {resolved.has(i)
                        ? "Text matches full label"
                        : line.confidence < 80
                          ? "Low OCR confidence"
                          : "Possible clipping"}
                    </small>
                    <span>{line.text}</span>
                  </button>
                  {selected === i && (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          compare(i);
                        }}
                      >
                        <label htmlFor={"ref-" + i}>
                          Expected text in this language
                        </label>
                        <input
                          id={"ref-" + i}
                          data-expected
                          value={expected}
                          onChange={(e) => setExpected(e.target.value)}
                          placeholder="Enter the full label"
                        />
                        <button
                          type="submit"
                          className="small-button"
                          data-compare
                          disabled={!expected.trim()}
                        >
                          Compare text
                        </button>
                        {judgments[i]?.value === expected && (
                          <p className="comparison" role="status">
                            {judgments[i].outcome === "complete"
                              ? "The visible text matches the expected text."
                              : judgments[i].outcome === "shortened" &&
                                  line.confidence >= 80
                                ? "The visible prefix matches. Check the missing ending in the screenshot."
                                : "Unable to verify the full label. Review the image."}
                          </p>
                        )}
                      </form>
                      {scan.picture && (
                        <ReviewExport
                          key={JSON.stringify([
                            scan.picture.url,
                            language,
                            i,
                            expected,
                          ])}
                          picture={scan.picture}
                          region={{
                            x: line.bbox.x0,
                            y: line.bbox.y0,
                            width: line.bbox.x1 - line.bbox.x0,
                            height: line.bbox.y1 - line.bbox.y0,
                          }}
                          decision={decisions[i] ?? "Unreviewed"}
                          onDecision={(value) =>
                            setDecisions((previous) => ({
                              ...previous,
                              [i]: value,
                            }))
                          }
                          recognized={line.text}
                          expected={
                            resolvedArea === i &&
                            judgments[i]?.outcome !== "complete"
                              ? area.expected
                              : expected
                          }
                          machine={
                            resolved.has(i)
                              ? "Text matches full label." +
                                (resolvedArea === i
                                  ? " Verified by matching selected-area OCR."
                                  : "")
                              : (line.confidence < 80
                                  ? "Low OCR confidence; trailing ellipsis detected."
                                  : "Trailing ellipsis detected; possible clipping.") +
                                (judgments[i]?.value === expected
                                  ? " Text comparison: " +
                                    judgments[i].outcome +
                                    "."
                                  : "")
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
              {result && scan.lines.length > 0 && (
                <details className="transcript">
                  <summary>Recognized text ({scan.lines.length})</summary>
                  <p>{scan.lines.map((l) => l.text).join("\n")}</p>
                </details>
              )}
            </section>
            <section className="examples">
              <div className="section-heading">
                <h2>Try an example</h2>
              </div>
              {examples.map((e) => (
                <button
                  key={e.id}
                  data-example={e.id}
                  className={"example ex-" + e.id}
                  onClick={() => example(e.id)}
                >
                  <span className="glyph" aria-hidden="true">
                    {e.sample}
                  </span>
                  <span className="example-info">
                    <strong>{e.title}</strong>
                    <small>{e.subtitle}</small>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </section>
          </aside>
        </div>
        {notice && (
          <p role="alert" className="error">
            {notice}
          </p>
        )}
      </main>
      {dragging && (
        <div className="drag-mask">
          <div>
            <Icon name="upload" size={25} />
            Drop one PNG to inspect
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Inspector />);
