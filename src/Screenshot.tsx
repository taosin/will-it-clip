import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import type { Picture } from "./useScan";
import type { ScanLine } from "./ocr";
import type { Region } from "./region";
import "./region-selection.css";

type Props = {
  picture: Picture;
  candidates: { line: ScanLine; i: number }[];
  selected: number | null;
  onSelect: (id: number) => void;
  selecting: boolean;
  region: Region | null;
  onRegion: (region: Region) => void;
  onCancelSelect: () => void;
};
type Point = { x: number; y: number };

function originalPoint(
  e: PointerEvent<HTMLDivElement>,
  picture: Picture,
): Point {
  const bounds = e.currentTarget.getBoundingClientRect();
  const position = (n: number, size: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * size);
  return {
    x: position((e.clientX - bounds.left) / bounds.width, picture.width),
    y: position((e.clientY - bounds.top) / bounds.height, picture.height),
  };
}

function between(a: Point, b: Point): Region {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function relativeStyle(rect: Region, picture: Picture) {
  return {
    left: (100 * rect.x) / picture.width + "%",
    top: (100 * rect.y) / picture.height + "%",
    width: (100 * rect.width) / picture.width + "%",
    height: (100 * rect.height) / picture.height + "%",
  };
}

function Coordinates({
  picture,
  onRegion,
  onPreview,
}: {
  picture: Picture;
  onRegion: (region: Region) => void;
  onPreview: (region: Region | null) => void;
}) {
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const fields = ["x", "y", "width", "height"] as const;
  const defaults: Region = {
    x: 0,
    y: 0,
    width: picture.width,
    height: picture.height,
  };
  function read(): Region | null {
    if (!form.current) return null;
    const rect = { ...defaults };
    for (const key of fields) {
      const input = form.current.elements.namedItem(key) as HTMLInputElement;
      if (!input.validity.valid || !Number.isInteger(input.valueAsNumber))
        return null;
      rect[key] = input.valueAsNumber;
    }
    return rect.x + rect.width <= picture.width &&
      rect.y + rect.height <= picture.height
      ? rect
      : null;
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rect = read();
    if (rect) onRegion(rect);
    else
      setError(
        "Keep the area inside the screenshot and at least 8 × 8 pixels.",
      );
  }
  return (
    <details
      className="region-coordinates"
      onToggle={(e) => onPreview(e.currentTarget.open ? read() : null)}
    >
      <summary data-region-coordinates>Enter coordinates</summary>
      <form
        ref={form}
        onSubmit={submit}
        onChange={() => {
          setError("");
          onPreview(read());
        }}
      >
        <p>
          Original pixels from the top left · {picture.width} × {picture.height}{" "}
          px
        </p>
        <div className="coordinate-fields">
          {fields.map((k) => (
            <label key={k}>
              {k === "x"
                ? "Left"
                : k === "y"
                  ? "Top"
                  : k === "width"
                    ? "Width"
                    : "Height"}
              <input
                type="number"
                name={k}
                step="1"
                min={k === "width" || k === "height" ? 8 : 0}
                required
                max={
                  k === "x" || k === "width" ? picture.width : picture.height
                }
                defaultValue={defaults[k]}
              />
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="small-button" data-region-apply>
          Read area
        </button>
      </form>
    </details>
  );
}

export function Screenshot({
  picture,
  candidates,
  selected,
  onSelect,
  selecting,
  region,
  onRegion,
  onCancelSelect,
}: Props) {
  const drag = useRef<{ id: number; start: Point } | null>(null);
  const [draft, setDraft] = useState<Region | null>(null);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    drag.current = null;
    setDraft(null);
    setWarning("");
  }, [selecting, picture.url]);

  useEffect(() => {
    if (!selecting) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelSelect();
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selecting, onCancelSelect]);

  function start(e: PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || e.button !== 0 || drag.current) return;
    const start = originalPoint(e, picture);
    drag.current = { id: e.pointerId, start };
    setWarning("");
    setDraft(between(start, start));
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    setDraft(between(drag.current.start, originalPoint(e, picture)));
  }
  function finish(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    const rect = between(drag.current.start, originalPoint(e, picture));
    drag.current = null;
    setDraft(null);
    if (rect.width < 8 || rect.height < 8) {
      setWarning("Choose a larger area around the label.");
      return;
    }
    onRegion(rect);
  }
  function abort(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDraft(null);
  }

  const current = selecting ? draft : region;
  return (
    <>
      <div className="stage">
        <div
          className="raster"
          style={{
            width:
              "min(100%, " + (580 * picture.width) / picture.height + "px)",
          }}
        >
          <img
            src={picture.url}
            alt={"Preview of " + picture.name}
            width={picture.width}
            height={picture.height}
            draggable={false}
          />
          {candidates.map(({ i, line }) => (
            <button
              key={i}
              aria-label={"Review " + line.text}
              className={"box " + (selected === i ? "chosen" : "")}
              disabled={selecting}
              onClick={() => onSelect(i)}
              style={relativeStyle(
                {
                  x: line.bbox.x0,
                  y: line.bbox.y0,
                  width: line.bbox.x1 - line.bbox.x0,
                  height: line.bbox.y1 - line.bbox.y0,
                },
                picture,
              )}
            />
          ))}
          {current && current.width > 0 && current.height > 0 && (
            <div
              className="region-outline"
              aria-hidden="true"
              data-region-box
              style={relativeStyle(current, picture)}
            />
          )}
          {selecting && (
            <div
              className="region-surface"
              aria-hidden="true"
              data-region-surface
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={abort}
              onLostPointerCapture={abort}
            />
          )}
        </div>
      </div>
      {selecting && (
        <div className="region-tools">
          {warning && <p role="alert">{warning}</p>}
          <Coordinates
            key={picture.url}
            picture={picture}
            onRegion={onRegion}
            onPreview={setDraft}
          />
        </div>
      )}
    </>
  );
}
