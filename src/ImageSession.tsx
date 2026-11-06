import { useEffect, useRef, useState, type ReactNode } from "react";
import { SessionMemory, type Memory } from "./SessionState";
import { pngDimensions } from "./input";
import { availableSlots, sessionCounts } from "./session";
import type { Picture } from "./useScan";

type Entry = { id: number; name: string; memory: Memory };
export type SessionControls = {
  panel: ReactNode;
  add: (files: FileList | null) => void;
  example: (id: string, language: string) => void;
  remove: () => void;
  reference: Picture | null;
};
async function prepare(file: Blob, name: string): Promise<Picture> {
  const dims = await pngDimensions(file);
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (
      image.naturalWidth !== dims.width ||
      image.naturalHeight !== dims.height
    )
      throw new Error("The PNG dimensions could not be verified.");
    return { url, name, ...dims };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  } finally {
    image.src = "";
  }
}
function release(entry: Entry) {
  const picture = entry.memory.get("scan-picture") as Picture | undefined;
  const result = entry.memory.get("area-result") as
    { preview?: string } | undefined;
  if (picture) URL.revokeObjectURL(picture.url);
  if (result?.preview) URL.revokeObjectURL(result.preview);
  entry.memory.clear();
}
export function ImageSession({
  children,
}: {
  children: (controls: SessionControls) => ReactNode;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const currentEntries = useRef(entries);
  currentEntries.current = entries;
  const [selected, select] = useState<number | null>(null);
  const [, refresh] = useState(0);
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState(false);
  const busy = useRef(false);
  const sequence = useRef(0);
  const referenceGeneration = useRef(0);
  const [referenceOpening, setReferenceOpening] = useState(false);
  const [reference, setReference] = useState<Picture | null>(null);
  const refPicture = useRef(reference);
  refPicture.current = reference;
  const referenceInput = useRef<HTMLInputElement>(null);
  const empty = useRef<Memory>(new Map());
  const active = entries.find((e) => e.id === selected);
  const memory = active?.memory ?? empty.current;
  memory.set("_notify", () => refresh((n) => n + 1));
  useEffect(
    () => () => {
      referenceGeneration.current++;
      currentEntries.current.forEach(release);
      if (refPicture.current) URL.revokeObjectURL(refPicture.current.url);
    },
    [],
  );
  async function add(files: FileList | null) {
    if (!files?.length || busy.current) return;
    busy.current = true;
    setOpening(true);
    const added: Entry[] = [],
      errors: string[] = [];
    const slots = availableSlots(currentEntries.current.length);
    const language = memory.get("language") ?? "eng";
    for (const file of Array.from(files)) {
      if (added.length >= slots) {
        errors.push(
          file.name + ": Six-image limit reached. Remove an image first.",
        );
        continue;
      }
      try {
        const picture = await prepare(file, file.name);
        const memory: Memory = new Map([
          ["scan-picture", picture],
          ["scan-phase", "ready"],
          ["scan-last", { name: file.name, file }],
          ["language", language],
          ["area-phase", "selecting"],
        ] as [string, unknown][]);
        added.push({ id: ++sequence.current, name: file.name, memory });
      } catch (error) {
        errors.push(
          file.name +
            ": " +
            (error instanceof Error ? error.message : "Could not open PNG."),
        );
      }
    }
    if (added.length) {
      setEntries((previous) => [...previous, ...added]);
      select(added[0].id);
    }
    setNotice(errors.join(" "));
    busy.current = false;
    setOpening(false);
  }
  function remove(id: number) {
    const remaining = entries.filter((e) => e.id !== id);
    const removed = entries.find((e) => e.id === id);
    setEntries(remaining);
    if (selected === id) select(remaining[0]?.id ?? null);
    // React unmounts the active inspector before releasing its retained snapshots.
    if (removed) setTimeout(() => release(removed), 0);
  }
  function example(id: string, language: string) {
    if (busy.current) {
      setNotice("Wait for the PNG import to finish before opening an example.");
      return;
    }
    if (!availableSlots(entries.length)) {
      setNotice("Six-image limit reached. Remove an image first.");
      return;
    }
    const memory: Memory = new Map([
      ["language", language],
      ["example", id],
    ]);
    const entry = { id: ++sequence.current, name: id + ".png", memory };
    setEntries((previous) => [...previous, entry]);
    select(entry.id);
  }
  const counts = sessionCounts(
    entries.map((e) => {
      const m = e.memory;
      const full = m.get("scan-phase") as string;
      const lines = m.get("decisions") as Record<number, string> | undefined;
      const candidates = m.get("scan-lines") as { text: string }[] | undefined;
      const decisions = (candidates ?? []).flatMap((line, i) =>
        /(?:…|\.{3})\s*$/.test(line.text) ? [lines?.[i] ?? "Unreviewed"] : [],
      );
      if (m.get("area-region"))
        decisions.push((m.get("area-decision") as string) ?? "Unreviewed");
      return { phase: full, decisions };
    }),
  );
  const areaCounts = sessionCounts(
    entries.map((e) => ({
      phase: String(e.memory.get("area-phase") ?? "idle"),
      decisions: [],
    })),
  );
  function clearReference() {
    referenceGeneration.current++;
    if (refPicture.current) URL.revokeObjectURL(refPicture.current.url);
    refPicture.current = null;
    setReference(null);
    setReferenceOpening(false);
  }
  const panel = (
    <section className="session-panel" aria-label="Image session">
      <div className="session-heading">
        <strong>Image session · {entries.length}/6</strong>
        <button
          className="link-btn"
          disabled={
            (!entries.length && !reference && !referenceOpening) || opening
          }
          onClick={() => {
            const removed = entries;
            setEntries([]);
            select(null);
            clearReference();
            setNotice("");
            setTimeout(() => removed.forEach(release), 0);
          }}
        >
          Clear session
        </button>
      </div>
      <p className="muted">
        Select an area and compare its expected text. Optional full-image OCR
        finds clues; it cannot prove a screenshot is correct.
      </p>
      <p className="session-counts" role="status">
        Full-image scans: {counts.success} successful · {counts.failed} failed ·{" "}
        {counts.unread} unread · {counts.cancelled} cancelled. Area scans:{" "}
        {areaCounts.success} successful · {areaCounts.failed} failed ·{" "}
        {areaCounts.cancelled} cancelled. Review decisions (findings + area):{" "}
        {counts.reviewed} reviewed · {counts.pending} pending.
      </p>
      <div className="session-list">
        {entries.map((e) => (
          <div className="session-item" key={e.id}>
            <button
              className="session-pick"
              aria-pressed={e.id === selected}
              onClick={() => select(e.id)}
            >
              <strong>{e.name}</strong>
              <small>
                {e.memory.get("language") === "eng" ? "English" : "German"} ·
                Full image: {String(e.memory.get("scan-phase") ?? "ready")} ·
                Area: {String(e.memory.get("area-phase") ?? "not selected")}
              </small>
            </button>
            <button
              className="link-btn"
              aria-label={"Remove " + e.name}
              onClick={() => remove(e.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="session-reference">
        <button
          className="small-button"
          onClick={() => referenceInput.current?.click()}
          disabled={opening}
        >
          Choose reference PNG
        </button>
        {(reference || referenceOpening) && (
          <button className="link-btn" onClick={clearReference}>
            {referenceOpening ? "Cancel reference import" : "Remove reference"}
          </button>
        )}
        <span>
          Optional visual comparison only. No translation is inferred.
        </span>
      </div>
      <input
        type="file"
        hidden
        ref={referenceInput}
        accept="image/png,.png"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const generation = ++referenceGeneration.current;
          setReferenceOpening(true);
          try {
            const next = await prepare(file, file.name);
            if (generation !== referenceGeneration.current) {
              URL.revokeObjectURL(next.url);
              return;
            }
            if (refPicture.current) URL.revokeObjectURL(refPicture.current.url);
            refPicture.current = next;
            setReference(next);
          } catch (error) {
            if (generation === referenceGeneration.current)
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Could not open reference.",
              );
          } finally {
            if (generation === referenceGeneration.current)
              setReferenceOpening(false);
          }
        }}
      />
      {opening && <p role="status">Opening PNGs…</p>}
      {notice && (
        <p role="alert" className="error">
          {notice}
        </p>
      )}
    </section>
  );
  return (
    <SessionMemory.Provider value={memory} key={active?.id ?? "empty"}>
      {children({
        panel,
        add,
        example,
        remove: () => active && remove(active.id),
        reference,
      })}
    </SessionMemory.Provider>
  );
}
