import { appendFileSync, writeFileSync } from "node:fs";

const homepage = new URL("https://privacy.iamtaoxin.com/will-it-clip/");
const key = process.env.INDEXNOW_KEY;
const mode = process.argv[2];

function report(message, warning = false) {
  console.log(warning ? `::warning::${message}` : message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### IndexNow\n\n${message}\n`);
  }
}

async function keyIsPublished(keyLocation) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(keyLocation, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 200 && (await response.text()) === key) return true;
    } catch {
      // The CDN may still be serving the previous deployment.
    }
    if (attempt < 8) await new Promise(resolve => setTimeout(resolve, 15_000));
  }
  return false;
}

async function notify() {
  const keyLocation = new URL(`${key}.txt`, homepage).href;
  if (!(await keyIsPublished(keyLocation))) {
    report("Skipped submission. The published key file could not be verified. Check the Pages artifact and CDN, then retry.", true);
    process.exitCode = 1;
    return;
  }

  let response;
  try {
    response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ host: homepage.host, key, keyLocation, urlList: [homepage.href] }),
    });
  } catch {
    report("IndexNow returned no receipt. Check service availability before retrying.", true);
    process.exitCode = 1;
    return;
  }

  if (response.status === 200) {
    report("IndexNow received the homepage URL (HTTP 200). Each search engine decides whether to index it.");
  } else if (response.status === 202) {
    report("IndexNow received the homepage URL (HTTP 202). Key validation is pending.");
  } else {
    report(`IndexNow returned HTTP ${response.status}. Check the [response codes](https://www.indexnow.org/documentation) before retrying.`, true);
    process.exitCode = 1;
  }
}

if (!["prepare", "notify"].includes(mode)) {
  throw new Error("Expected prepare or notify.");
} else if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
  report("Skipped IndexNow. Configure INDEXNOW_KEY with 8–128 letters, digits or hyphens.", Boolean(key) || mode === "notify");
  if (mode === "notify") process.exitCode = 1;
} else if (mode === "prepare") {
  try {
    writeFileSync(`dist/${key}.txt`, key);
  } catch {
    throw new Error("Could not write the IndexNow verification file to dist.");
  }
} else {
  await notify();
}
