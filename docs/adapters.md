# Adapter reference

An adapter is plain JSON. Duplicate `id` replaces the locally saved profile; use a new ID to keep both.

| Field | Meaning |
| --- | --- |
| `id`, `name` | Stable profile ID and display label |
| `mode` | `page` (85% viewport scroll), `end` (current bottom), or `next` |
| `itemSelector` | CSS selector for each loaded record; empty uses main/body snapshots |
| `dateSelector`, `dateAttribute` | Date node inside each record; optional source attribute such as `datetime` |
| `linkSelector`, `idAttribute` | Specific record URL / stable record identity for deduplication |
| `scrollSelector` | Scroll container; empty uses the document |
| `endSelector` | Visible explicit end marker; empty never confirms a final end |
| `busySelector` | Visible loading indicator |
| `nextSelector` | A next-page link/button; needed for `next` mode |
| `pinnedSelector` | Pinned items ignored for cutoff-tail checks |
| `newestFirst` | Enables cutoff checks only after ordering is confirmed |
| `boundaryItems` | Consecutive definitely older tail items required, 1–20 (default 3) |
| `intervalMs` | Time to let the site load between steps, 1000–60000 |
| `maxSteps` | 1–2000; separate 30-minute and content-budget limits apply |

Relative labels preserve their uncertainty interval. Exact ISO timestamps must contain a timezone. Date-only labels are compared as UTC calendar-day ranges. Unknown dates stay unknown. Pinned/reposted items and newly changed posts require particular care when asserting chronological ordering.

Selectors use standard CSS; hidden buttons, cross-origin next links and new-tab next links are not followed. Iframes and closed Shadow DOM are not traversed. No JavaScript, XPath, credential or API fields are supported.

`local-page-save/v1` exports contain a `run` (configuration, times, source and coverage reason) and ordered `records` (identity, text, inert HTML, links, observed time and original date/range). A page may be partially covered even after an older date is observed. This archive format is evidence for later analysis, not a job-publication payload.
