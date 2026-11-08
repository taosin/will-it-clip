import { useEffect, useContext, useRef, useState, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import { ImageSession, type SessionControls } from "./ImageSession";
import { useImageState, SessionMemory } from "./SessionState";
import { Icon } from "./Icon";
import { PageHeader, Introduction } from "./Introduction";
import { compareText, hasTrailingEllipsis, matchedCandidate } from "./review";
import { useScan, type Language, type Source } from "./useScan";
import { Screenshot } from "./Screenshot";
import { useRegionScan } from "./useRegionScan";
import { RegionReview } from "./RegionReview";
import { ReviewExport } from "./ReviewExport";
import type { HumanDecision } from "./annotation";

import { examples } from "./examples";

const assets = import.meta.env.BASE_URL;

function Inspector({ session }: { session: SessionControls }) {
  const memory = useContext(SessionMemory)!;
  const scan = useScan();
  const area = useRegionScan();
  const [language, setLanguage] = useImageState<Language>("language", "eng");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [notice, setNotice] = useState("");
  const [selected, select] = useImageState<number | null>("selected", null);
  const [expectedByLine, setExpectedByLine] = useImageState<
    Record<number, string>
  >("expectedByLine", {});
  const [decisions, setDecisions] = useImageState<
    Record<number, HumanDecision>
  >("decisions", {});
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
  const [judgments, setJudgments] = useImageState<
    Record<number, { value: string; outcome: ReturnType<typeof compareText> }>
  >("judgments", {});
  const input = useRef<HTMLInputElement>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  const revealExample = useRef(false);
  function keepPosition() {
    revealExample.current = false;
  }
  useEffect(() => {
    if (area.phase !== "complete" || !revealExample.current) return;
    keepPosition();
    if (document.activeElement !== document.body) return;
    reviewPanel.current?.focus({ preventScroll: true });
    reviewPanel.current?.scrollIntoView({ block: "start" });
  }, [area.phase]);
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
    session.add(files);
  }
  async function inspect(source: Source) {
    const guide = examples.find(
      (item) => item.id === memory.get("pending-example"),
    );
    revealExample.current = !!guide;
    const picture = await scan.run(source, language);
    if (picture && guide && memory.get("pending-example") === guide.id) {
      memory.delete("pending-example");
      await area.read(picture, language, guide.region, guide.expected);
    }
  }
  useEffect(() => {
    const id = memory.get("example") as string | undefined;
    if (id) {
      memory.delete("example");
      memory.set("pending-example", id);
      void inspect({
        name: id + ".png",
        url: assets + "examples/" + id + ".png",
      });
    }
  }, []);
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
  const working = scan.phase === "reading" || area.phase === "reading";
  return (
    <div
      className="app"
      onPointerDownCapture={keepPosition}
      onKeyDownCapture={keepPosition}
      onWheelCapture={keepPosition}
      onFocusCapture={keepPosition}
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
      <PageHeader base={assets} />
      <main>
        <Introduction
          base={assets}
          demoVersion={import.meta.env.VITE_DEMO_VERSION}
          showActions={!scan.last && !scan.picture}
          onExample={() => session.example(examples[0])}
        />
        {session.panel}
        <input
          multiple
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
                {scan.picture && !working && (
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
                      if (scan.phase === "reading") scan.cancel();
                      else if (area.phase === "reading") area.cancel();
                      else session.remove();
                    }}
                  >
                    {working ? "Cancel" : "Remove image"}
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
              <div className={session.reference ? "comparison-images" : ""}>
                <div>
                  <Screenshot
                    picture={scan.picture}
                    selecting={area.phase === "selecting"}
                    region={area.region}
                    onRegion={(region) => {
                      memory.delete("pending-example");
                      if (scan.picture)
                        void area.read(scan.picture, language, region);
                    }}
                    onCancelSelect={area.clear}
                    candidates={activeCandidates}
                    selected={selected}
                    onSelect={chooseLine}
                  />
                </div>
                {session.reference && (
                  <figure className="reference-image">
                    <figcaption>
                      Reference · {session.reference.name}
                    </figcaption>
                    <img
                      src={session.reference.url}
                      alt={"Reference screenshot " + session.reference.name}
                    />
                  </figure>
                )}
              </div>
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
                  {working ? "Opening screenshot…" : "Drop up to six PNGs here"}
                </h2>
                <p>PNG · up to 12 MiB · 6 megapixels</p>
                {!working && (
                  <button
                    className="primary"
                    onClick={() => input.current?.click()}
                  >
                    Choose screenshots <Icon name="arrow" size={16} />
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
                disabled={working}
                value={language}
                onChange={(e) => {
                  const lang = e.target.value as Language;
                  setLanguage(lang);
                  memory.delete("pending-example");
                  clearReview();
                  scan.invalidate();
                }}
              >
                <option value="eng">English</option>
                <option value="deu">German</option>
              </select>
            </section>
            {scan.picture && (
              <section className="settings scan-option">
                <button
                  className="small-button"
                  disabled={working}
                  onClick={() => {
                    memory.delete("pending-example");
                    clearReview();
                    if (scan.last) void scan.run(scan.last, language);
                  }}
                >
                  Scan full image (optional)
                </button>
                <p className="muted">
                  Experimental clue finder. Review selected areas even when no
                  clues are found.
                </p>
              </section>
            )}
            <RegionReview
              panelRef={reviewPanel}
              scan={area}
              picture={scan.picture}
              language={language}
              retry={() => {
                if (scan.picture && area.region)
                  void area.read(
                    scan.picture,
                    language,
                    area.region,
                    area.expected,
                  );
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
                {(scan.phase === "idle" ||
                  scan.phase === "ready" ||
                  scan.phase === "cancelled") && (
                  <p className="muted">
                    {scan.phase === "cancelled"
                      ? "Full-image scan cancelled. Retry when ready."
                      : scan.picture
                        ? "Select an area around a label, then enter its full expected text."
                        : "Open PNGs or try an example to inspect its text."}
                  </p>
                )}
                {scan.phase === "reading" && (
                  <>
                    <p className="reading">
                      {scan.progress > 0
                        ? "Reading text…"
                        : "Preparing local recognition…"}
                    </p>
                    <progress max={1} value={scan.progress || undefined} />
                  </>
                )}
                {(scan.phase === "error" || scan.phase === "cancelled") && (
                  <>
                    {scan.phase === "error" && (
                      <p className="error">{scan.error}</p>
                    )}
                    {scan.last && (
                      <button
                        className="small-button"
                        disabled={working}
                        onClick={() => {
                          clearReview();
                          void inspect(scan.last!);
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
                      matching && !activeCandidates.length
                        ? "success-note"
                        : "result-caption"
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
              <p className="muted">
                Each example compares the selected text with its original
                wording. You can edit the wording and compare again.
              </p>
              {examples.map((e) => (
                <div key={e.id} className="example-row">
                  <button
                    data-example={e.id}
                    className={"example ex-" + e.id}
                    onClick={() => session.example(e)}
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
                  <a
                    className="example-link"
                    href={assets + "?example=" + e.id}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={e.title + " example link (opens in a new tab)"}
                  >
                    Example link
                  </a>
                </div>
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
            Drop up to six PNGs to inspect
          </div>
        </div>
      )}
    </div>
  );
}
const requestedExample = new URLSearchParams(window.location.search).get("example");
const initialExample = examples.find((item) => item.id === requestedExample);

createRoot(document.getElementById("root")!).render(
  <ImageSession initialExample={initialExample}>
    {(session) => <Inspector session={session} />}
  </ImageSession>,
);
