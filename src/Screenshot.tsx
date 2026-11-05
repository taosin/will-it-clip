import type { Picture } from "./useScan";
import type { ScanLine } from "./ocr";

export function Screenshot({
  picture,
  candidates,
  selected,
  onSelect,
}: {
  picture: Picture;
  candidates: { line: ScanLine; i: number }[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="stage">
      <div
        className="raster"
        style={{
          width: "min(100%, " + (580 * picture.width) / picture.height + "px)",
        }}
      >
        <img
          src={picture.url}
          alt={"Preview of " + picture.name}
          width={picture.width}
          height={picture.height}
        />
        {candidates.map(({ i, line }) => (
          <button
            key={i}
            aria-label={"Review " + line.text}
            className={"box " + (selected === i ? "chosen" : "")}
            onClick={() => onSelect(i)}
            style={{
              left: (100 * line.bbox.x0) / picture.width + "%",
              top: (100 * line.bbox.y0) / picture.height + "%",
              width:
                (100 * (line.bbox.x1 - line.bbox.x0)) / picture.width + "%",
              height:
                (100 * (line.bbox.y1 - line.bbox.y0)) / picture.height + "%",
            }}
          />
        ))}
      </div>
    </div>
  );
}
