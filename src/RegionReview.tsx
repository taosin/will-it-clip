import type { Ref } from "react";
import { ReviewExport } from "./ReviewExport";
import type { Picture } from "./useScan";
import { Icon } from "./Icon";
import { compareLabel, hasTrailingEllipsis } from "./review";
import type { useRegionScan } from "./useRegionScan";
import "./region-review.css";

const recognitionFeedbackUrl =
  "https://github.com/taosin/will-it-clip/issues/new?template=recognition-feedback.yml";

export function RegionReview({
  panelRef,
  scan,
  retry,
  picture,
  language,
}: {
  panelRef: Ref<HTMLElement>;
  scan: ReturnType<typeof useRegionScan>;
  retry: () => void;
  picture: Picture | null;
  language: string;
}) {
  if (scan.phase === "idle") return null;
  const comparison =
    scan.verdict === "shortened" && scan.result?.reliable
      ? compareLabel(scan.result.text, scan.expected)
      : null;
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="region-review"
      aria-label="Selected area review"
      data-region-status={scan.phase}
    >
      <header className="section-heading">
        <Icon name="brackets" size={17} />
        <h2>Selected area</h2>
        <button
          type="button"
          className="link-btn"
          onClick={scan.phase === "reading" ? scan.cancel : scan.clear}
        >
          {scan.phase === "reading" || scan.phase === "selecting"
            ? "Cancel"
            : "Dismiss"}
        </button>
      </header>
      {scan.phase === "selecting" && (
        <p className="muted">
          Drag around one label, including all its lines and a little space
          around the letters.
        </p>
      )}
      {scan.phase === "reading" && (
        <p className="reading" role="status">
          Reading the selected area…
        </p>
      )}
      {(scan.phase === "error" || scan.phase === "cancelled") && (
        <div role="alert">
          <p className="error">
            {scan.phase === "cancelled"
              ? "Area scan cancelled. Retry when ready."
              : scan.error}
          </p>
          <button className="small-button" onClick={retry}>
            Retry area
          </button>
        </div>
      )}
      {scan.phase === "complete" && scan.result && (
        <>
          <div className="region-crop">
            <img
              src={scan.result.preview}
              alt="Enlarged crop of the selected label"
            />
          </div>
          <p className="region-kicker">Recognized text</p>
          <p className="region-text" data-region-text>
            {scan.result.text || "No readable text found."}
          </p>
          {scan.result.text &&
            (!scan.result.reliable ? (
              <p className="region-note">
                Uncertain reading. Check the crop or select a wider area.
              </p>
            ) : (
              hasTrailingEllipsis(scan.result.text) && (
                <p className="region-note">
                  Trailing ellipsis found. Compare with the full label below.
                </p>
              )
            ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scan.compare();
            }}
          >
            <label htmlFor="region-expected">
              Expected text in this language
            </label>
            <textarea
              id="region-expected"
              rows={2}
              data-region-expected
              value={scan.expected}
              onChange={(e) => scan.setExpected(e.target.value)}
              placeholder="Paste the full label"
            />
            <button
              className="small-button"
              data-region-compare
              disabled={!scan.expected.trim()}
            >
              Compare text
            </button>
          </form>
          {scan.verdict && (
            <p
              className="region-verdict"
              role="status"
              data-region-verdict={scan.verdict}
            >
              {scan.verdict === "complete"
                ? "The visible text matches the full label."
                : scan.verdict === "shortened"
                  ? "The visible prefix matches, but the ending is missing. Check the screenshot to confirm."
                  : "Unable to verify the full label. Review the crop and the expected text."}
              {comparison?.verdict === "shortened" && (
                <span className="missing-ending">
                  Missing from the visible label
                  <strong data-missing-text>{comparison.missing}</strong>
                </span>
              )}
            </p>
          )}
        </>
      )}
      {scan.phase === "error" && (
        <label className="region-kicker" htmlFor="region-expected-error">
          Expected text in this language
          <textarea
            id="region-expected-error"
            rows={2}
            value={scan.expected}
            onChange={(e) => scan.setExpected(e.target.value)}
          />
        </label>
      )}
      {(scan.phase === "complete" || scan.phase === "error") && (
        <p className="region-feedback">
          <a
            href={recognitionFeedbackUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Report a reading or comparison problem on GitHub
          </a>
          <span>
            Opens a blank form in a new tab. Submitted issues are public.
          </span>
        </p>
      )}
      {(scan.phase === "complete" || scan.phase === "error") &&
        picture &&
        scan.region && (
          <ReviewExport
            key={JSON.stringify([
              picture.url,
              language,
              scan.region,
              scan.expected,
            ])}
            picture={picture}
            region={scan.region}
            decision={scan.decision}
            onDecision={scan.setDecision}
            recognized={scan.result?.text ?? ""}
            expected={scan.expected}
            machine={
              scan.phase === "error"
                ? "Area OCR failed; manual visual review only."
                : (scan.result?.reliable
                    ? "Area OCR reading; clipping requires visual review."
                    : "Uncertain area OCR reading.") +
                  (scan.verdict
                    ? " Text comparison: " + scan.verdict + "."
                    : "")
            }
          />
        )}
    </section>
  );
}
