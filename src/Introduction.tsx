import { Icon } from "./Icon";

export function PageHeader({ base }: { base: string }) {
  return (
    <header className="bar">
      <div className="bar-inner">
        <a className="brand" href={base} aria-label="Will It Clip? home">
          <img src={base + "mark.svg"} width="32" height="32" alt="" fetchPriority="low" />
          Will It Clip?
        </a>
        <div className="privacy">
          <Icon name="shield" size={16} /> Runs on your device
        </div>
      </div>
    </header>
  );
}

type IntroProps = {
  base: string;
  demoVersion: string;
  showActions?: boolean;
  onExample?: () => void;
};

export function Introduction({
  base,
  demoVersion,
  showActions = true,
  onExample,
}: IntroProps) {
  return (
    <section className="intro">
      <h1>
        Check for clipped text<span className="title-dot">.</span>
      </h1>
      <p>
        Review text truncation in a PNG screenshot during localization QA. Select a
        translated label, enter its full wording, and compare it with the visible
        text. Export the annotated crop for a bug report.
      </p>
      <p className="muted">
        Experimental English and German OCR runs in your browser. The language model
        downloads on first use. Screenshots stay on your device. Full-image scans look
        for trailing ellipses and may miss hard cut-offs.
      </p>
      {showActions && (
        <div className="intro-actions">
          {onExample ? (
            <button className="small-button intro-example" onClick={onExample}>
              Try a sample screenshot <Icon name="arrow" size={16} />
            </button>
          ) : (
            <a href={base + "examples/clipped.png"}>View the sample PNG</a>
          )}
          <a href={base + "demo.gif?v=" + demoVersion}>Watch the 10-second demo</a>
          <a href={base + "cases/signal-german-text/"}>Signal’s cut-off privacy notice</a>
          <a href="https://github.com/taosin/will-it-clip">GitHub</a>
        </div>
      )}
    </section>
  );
}

export function StaticLanding({ base, demoVersion }: IntroProps) {
  return (
    <div className="app">
      <PageHeader base={base} />
      <main>
        <Introduction base={base} demoVersion={demoVersion} />
        <noscript>Enable JavaScript to inspect a screenshot in your browser.</noscript>
      </main>
    </div>
  );
}
