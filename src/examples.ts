export const examples = [
  {
    id: "clipped",
    title: "Clipped title",
    subtitle: "German",
    lang: "deu",
    sample: "Aa…",
    region: { x: 130, y: 480, width: 520, height: 170 },
    expected: "Überprüfe deinen Posteingang",
  },
  {
    id: "wrapped",
    title: "Wrapped title",
    subtitle: "German",
    lang: "deu",
    sample: "Aa",
    region: { x: 130, y: 480, width: 520, height: 170 },
    expected: "Überprüfe deinen Posteingang",
  },
  {
    id: "loading",
    title: "Intentional ellipsis",
    subtitle: "English",
    lang: "eng",
    sample: "…",
    region: { x: 230, y: 470, width: 320, height: 130 },
    expected: "Loading…",
  },
] as const;

export type Example = (typeof examples)[number];
