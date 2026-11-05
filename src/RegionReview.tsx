import { Icon } from "./Icon";
import { hasTrailingEllipsis } from "./review";
import type { useRegionScan } from "./useRegionScan";
import "./region-review.css";

export function RegionReview({
  scan,
  retry,
}: {
  scan: ReturnType<typeof useRegionScan>;
  retry: () => void;
}) {
  if (scan.phase === "idle") return null;
  return (
    <section
      className="region-review"
      aria-label="Selected area review"
      data-region-status={scan.phase}
    >
      <header className="section-heading">
        <Icon name="brackets" size={17} />
        <h2>Selected area</h2>
        <button type="button" className="link-btn" onClick={scan.clear}>
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
      {scan.phase === "error" && (
        <div role="alert">
          <p className="error">{scan.error}</p>
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
          {scan.result.text && (
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
          )}
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
            </p>
          )}
        </>
      )}
    </section>
  );
}
