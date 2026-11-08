import { useEffect, useId, useState } from "react";
import { renderAnnotation, type HumanDecision } from "./annotation";
import { formatIssueReport } from "./issueReport";
import type { Region } from "./region";
import type { Picture } from "./useScan";
import "./review-export.css";

function selectReport(field: HTMLTextAreaElement | null) {
  if (field) {
    field.focus();
    field.select();
  }
}

function IssueReportCopy({ report }: { report: string }) {
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "manual"
  >("idle");

  async function copyReport() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(report);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  return (
    <>
      <button
        type="button"
        className="small-button"
        disabled={status === "copying"}
        onClick={copyReport}
      >
        Copy GitHub issue report
      </button>
      {status === "copied" && (
        <p role="status">Report copied. Paste it into your issue.</p>
      )}
      {status === "manual" && (
        <label className="report-fallback">
          Copy the report below and paste it into your issue.
          <textarea ref={selectReport} value={report} readOnly rows={6} />
        </label>
      )}
    </>
  );
}

export function ReviewExport({
  picture,
  region,
  recognized,
  expected,
  missing,
  machine,
  decision,
  onDecision,
}: {
  picture: Picture;
  region: Region;
  recognized: string;
  expected: string;
  missing?: string;
  machine: string;
  decision: HumanDecision;
  onDecision: (decision: HumanDecision) => void;
}) {
  const id = useId();
  const report = formatIssueReport({
    expected, recognized, missing, machine, decision,
  });
  const [full, setFull] = useState(false);
  const [request, setRequest] = useState(0);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPreview("");
    setError("");
    setBusy(false);
    if (!request) return;
    const controller = new AbortController();
    let url = "";
    setBusy(true);
    void renderAnnotation(
      { ...picture, region, recognized, expected, machine, decision, full },
      controller.signal,
    )
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
        setBusy(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : "Could not create preview.",
          );
          setBusy(false);
        }
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    request,
    picture.url,
    picture.width,
    picture.height,
    region.x,
    region.y,
    region.width,
    region.height,
    recognized,
    expected,
    machine,
    decision,
    full,
  ]);
  function invalidate() {
    setRequest(0);
    setPreview("");
  }
  return (
    <div className="review-export">
      <fieldset>
        <legend>Human decision</legend>
        <p className="muted">
          Your review is separate from machine evidence. Confirmed means you
          checked and found clipping.
        </p>
        <div className="decision-options">
          {(["Unreviewed", "Confirmed", "Expected behavior"] as const).map(
            (value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={id}
                  value={value}
                  checked={decision === value}
                  onChange={() => {
                    invalidate();
                    onDecision(value);
                  }}
                />
                {value}
              </label>
            ),
          )}
        </div>
        {decision !== "Unreviewed" && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              invalidate();
              onDecision("Unreviewed");
            }}
          >
            Undo decision
          </button>
        )}
      </fieldset>
      <IssueReportCopy key={report} report={report} />
      <label className="export-full">
        <input
          type="checkbox"
          checked={full}
          onChange={(e) => {
            invalidate();
            setFull(e.target.checked);
          }}
        />
        Include full screenshot in export
      </label>
      <p className="muted">
        Default export includes only this area and a small border of context.
        Long annotations are shortened with ….
      </p>
      <button
        type="button"
        className="small-button"
        disabled={busy}
        onClick={() => setRequest((n) => n + 1)}
      >
        Preview annotated PNG
      </button>
      {busy && <p role="status">Rendering preview…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {preview && (
        <div className="export-preview">
          <img
            src={preview}
            alt="PNG export preview with selected area, text, machine evidence and human decision"
          />
          <a
            className="small-button"
            href={preview}
            download="will-it-clip-review.png"
          >
            Download PNG
          </a>
          <button type="button" className="link-btn" onClick={invalidate}>
            Close preview
          </button>
        </div>
      )}
    </div>
  );
}
