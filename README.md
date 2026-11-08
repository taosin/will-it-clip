# Will It Clip?

**English** | [简体中文](./README.zh-CN.md)

Will It Clip? is a localization QA tool for checking text truncation in app screenshots. Select an English or German label in a PNG and paste the full translation. The app uses OCR in your browser to read the label and shows the missing ending when the visible text matches the start of the translation.

**[Try Will It Clip? in your browser](https://privacy.iamtaoxin.com/will-it-clip/)** · [Run locally](#run-locally)

[Watch the clipped-title demo](https://github.com/taosin/will-it-clip/blob/main/public/demo.gif) to see how “Check your inbox” can turn into “Check your bum…” on a small screen. The sample recreates a German title cut short at *Po…*, partway through *Posteingang* (“inbox”). [Original Mastodon iOS report](https://github.com/mastodon/mastodon-ios/issues/1139)

[![Ten-second demo showing a clipped German title and the missing letters “steingang”](public/demo.gif)](https://github.com/taosin/will-it-clip/blob/main/public/demo.gif)

[Explore a second case from Signal iOS](https://privacy.iamtaoxin.com/will-it-clip/cases/signal-german-text/). Its German privacy notice lost the last two words without showing an ellipsis.

## What the examples show

| Screenshot | Expected text | Result |
| --- | --- | --- |
| `Überprüfe deinen Po…` | `Überprüfe deinen Posteingang` | The visible prefix matches. The missing ending is `steingang`. |
| `Überprüfe deinen`<br>`Posteingang` | `Überprüfe deinen Posteingang` | The full title fits across two lines. |
| `Loading…` | `Loading…` | The ellipsis is part of the expected label. |

## Check your own screenshot

1. Drop a PNG into the inspector and choose the **Text language**. If needed, click **Select area**, then draw a box around one label. Include every line and a little space around the letters.
2. Paste the full label in the same language and click **Compare text**. Check the enlarged crop alongside the recognized text. If the reading is uncertain, try a wider selection.
3. Choose **Confirmed** if you see clipping, or **Expected behavior** if the label looks right. Choose **Copy GitHub issue report** to copy the expected text, OCR reading, comparison and your decision. Paste it into your issue. To attach the screenshot evidence, choose **Preview annotated PNG**, then **Download PNG**. The default export includes the selected area and a small border of context.

You can review up to six PNGs per session. Each PNG can be up to 12 MiB and 6 megapixels, with a maximum of 8,192 pixels on either side. The optional **Scan full image** action looks for trailing ellipses. It can miss labels whose letters are cut off without an ellipsis.

**Privacy.** Screenshots, recognized text, and review decisions stay in the current tab. The browser downloads the recognition model for the selected language on first use. **Clear session** removes the screenshots and their results.

## Run locally

Use Node.js 22.12 or later and npm.

```sh
git clone https://github.com/taosin/will-it-clip.git
cd will-it-clip
npm ci
npm run dev
```

Open the local URL printed in the terminal. To preview a production build, run `npm run build` followed by `npm run preview`.
