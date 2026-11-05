type Kind =
  | "upload"
  | "image"
  | "arrow"
  | "shield"
  | "scan"
  | "cross"
  | "check"
  | "alert"
  | "brackets";
const paths: Record<Kind, string> = {
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5",
  image: "M3 4h18v16H3z M4 17l5-5 4 4 3-4 5 6 M15 8h.01",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  shield: "M12 3l8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6z M8.5 12l2.4 2.4 4.7-5",
  scan: "M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4m3-4h10",
  cross: "m6 6 12 12M6 18 18 6",
  check: "m4 12 5 5L20 6",
  alert: "M12 7v6m0 3h.01 M12 2 1 21h22z",
  brackets: "M9 5H5v14h4m6-14h4v14h-4",
};
export function Icon({ name, size = 18 }: { name: Kind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
