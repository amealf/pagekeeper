# Pagekeeper

A configurable Chrome extension that turns pages, saves loaded content locally, and closes the bound source tab after Chrome confirms the download completed.

**Status:** 0.1.0 preview. Not submitted to the Chrome Web Store. LinkedIn selectors are an uncalibrated starter profile, not a guarantee of complete history coverage. The initial UI is Chinese.

## Features

- Scroll a screen at a time, scroll to the current bottom, or click a configured next-page button.
- Site profiles specify content, date, identity, scroll container, pinned items, loading and end markers. Import/export profiles as JSON.
- Optional date cutoff for confirmed reverse-chronological lists. Rounded relative dates remain ranges; unknown dates retain coverage gaps.
- Save TXT, inert HTML, or structured JSON. Content observed before a virtualized list removes it is retained in local IndexedDB.
- Manual stop, loading-stall detection, step/time/content limits and interrupted-session recovery.
- Local-only operation. No telemetry, cookies, credentials, private site APIs, or external servers.

## Install the preview

1. Download the release ZIP or clone this repository.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the `extension` directory (or the root of the extracted release ZIP).
4. Pin Pagekeeper. On a source page, click its icon to open the control page and bind that source.

Chrome 116 or later is required. The control page is a normal extension tab, so browser assistants that support extension-tab DOM interaction can use its labelled controls after installation. This project does not provide or claim a native Codex tool integration.

## Usage

Choose a site profile, optional cutoff date, and output format. Click Start. Stop and save at any time. Downloads go to `Downloads/pagekeeper/` by default. Auto-close applies only to the bound tab whose URL still matches the final saved page. A failed or interrupted download leaves the source open.

A date cutoff requires an accurate post-date selector and a list known to be sorted newest first. Do not infer repost dates from an embedded original post or dates mentioned inside the body. Scrolling without growth is recorded as **partial**, not proof that all history was covered. Only a configured, visible end marker confirms the end of a list.

The saved HTML is a static archive with scripts, form fields and external resource loading removed; it preserves text and links, not the exact original appearance or unloaded images. Closed Shadow DOM, cross-origin frames, canvas-rendered content, and Chrome internal pages are unsupported. The extension does not expand “see more”, log in, or bypass platform restrictions. Browser scrolling does not establish compliance with a site's rules.

## Add a website

Open Custom site configuration. Copy a profile, give it a new `id` and `name`, adjust its CSS selectors, and save. No arbitrary JavaScript is accepted in profiles. For paginated websites set `mode` to `next` and provide a same-origin, same-tab `nextSelector`. See [adapter reference](docs/adapters.md).

## Development

No runtime dependencies or remote code are used.

```sh
npm test
npm run check
npm run package
npm run preview
```

The preview serves the real UI with a clearly labelled simulated Chrome API. It verifies layout and control logic, **not** installation, real browser permissions, service-worker lifecycle, or real-site selectors. The preview server binds only to `127.0.0.1`.

See [release checklist](docs/release.md), [privacy policy](PRIVACY.md), [security policy](SECURITY.md), and [Chinese guide](README.zh-CN.md).

## License

MIT. Pagekeeper is an independent project and is not affiliated with LinkedIn or Google.
