# Release checklist

## Automated and local checks

- `npm test`: date intervals, conservative stopping, unknown dates, frozen loading, exact source-tab close guard and worker download integration.
- `npm run check`: manifest/assets, syntax, profile validity and release allowlist.
- `npm run package`: ZIP built only from `extension/`; no recordings, credentials, local artifacts or preview mocks.
- Inspect the real UI at desktop, tablet and narrow widths. Test keyboard focus, configuration editing, empty/error/saved states and recovery with the labelled preview fixture.

## Real Chrome validation required before a stable/store release

- Load unpacked in Chrome 116+, bind an existing source via action and request a single optional website permission.
- Verify scroll, same-tab next-page navigation, selector failure, manual stop and real download success/interruption.
- Confirm a completed download immediately closes only the bound, unchanged URL; test navigation changes and already-closed sources.
- Close/reopen the control page and suspend/restart its service worker; recover the local archive without auto-resuming.
- Calibrate LinkedIn on the actual visible headers, original/repost identity and relative dates. Default ordering is unconfirmed.
- Check an ordinary long page, a nested scroller, and a virtualized list. Record actual coverage; do not infer end from stalled loading.

## Store submission

Prepare final store listing, actual extension screenshots, icon, public privacy-policy URL, permission justification, support contact, and a user-visible update note. Review current store policies before submission. No store submission or platform approval is implied by a GitHub release. Until the real Chrome checklist is completed, publish only a labelled preview/prerelease.
