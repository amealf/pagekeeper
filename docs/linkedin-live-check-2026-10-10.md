# LinkedIn live-page check — 2026-10-10

The target recent-activity page was opened in the user's existing Chrome. The original profile matched no items or header dates. The live UI uses `role=listitem`, `componentkey=update-card-focus…`, and the `ProfileRecentActivity…` list test ID instead of the old `feed-shared-update-v2` classes.

The revised declarative profile matched the 20 currently loaded cards. A header-date selector was checked against six cards, including Chinese hour/day/week labels; the record identity comes from the card's component key. This is a read-only DOM configuration check, not a run of the installed extension or proof of historical coverage.

Visible dates were not monotonically decreasing. Reshared cards showed the original issuer's post date; the profile owner's reshare date was not present in the inspected header. Keep `newestFirst=false`. Do not describe the observed original-post date as the profile's activity/reshare date, or infer complete three-month coverage from it.

Installed Pagekeeper control/tab invocation and real TXT download/auto-close remain pending manual loading. The browser connection explicitly rejects extension-management navigation; no workaround or hidden browser-state inspection was used.
