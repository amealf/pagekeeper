# Verification receipt — 2026-10-10

## Completed

- Focused Node tests cover date parsing and uncertainty, conservative chronological-tail cutoff, explicit end versus stalls, binding/download safeguards, recovered export and the release ZIP/icon encoder.
- Release checks confirm MV3, exact required permission list, no external messaging/broad mandatory hosts, valid profiles, JS syntax and local assets.
- Release packaging uses an explicit extension-file allowlist. Preview fixtures, user recordings, logs and other project data are excluded.
- Rendered the real control UI through the labelled preview fixture at desktop (1280), tablet (820) and narrow (390) widths. No horizontal overflow or overlapping controls was observed.
- Browser preview verified the three-month date shortcut, configuration editing/error feedback, disabled running controls, step-limit stop with HTML export, local-record recovery, and manual stop with an actual JSON file download. Source commands and completion callbacks in this fixture are simulated; this does not certify installed-extension tab closing.

## Not yet verified

- Installed Chrome extension: user installation is pending. Actual permissions, download events, worker suspension and tab closing have not been exercised in a real installed extension.
- Actual LinkedIn selectors and original/repost header dates are uncalibrated. No LinkedIn feed was opened or collected during this development task.

This receipt distinguishes the code/fixture checks from live browser evidence. Version 0.1.0 is a preview; no stable/store release claim is made.
