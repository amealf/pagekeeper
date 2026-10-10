# Privacy policy

Effective: 2026-10-10. Applies to Pagekeeper 0.1.0.

Pagekeeper reads the currently bound page's loaded text, HTML structure, links, date labels, page title and scroll state. It stores source URLs, observation times, site profiles, download state and local archives on the user's device using Chrome extension storage and IndexedDB. Exported files are stored in the user's download directory.

Pagekeeper does not send page content to a server. It contains no analytics, advertising, remote model calls or trackers. It does not read cookies, browser history, passwords or the content of unrelated tabs. Requests made by the original website, including configured next-page navigation, remain part of that website's own operation.

Permissions: `activeTab` grants temporary access when the user clicks the action; `scripting` reads and scrolls the bound page; `storage` stores settings and job state; `downloads` saves files and observes completion. Optional host permissions are requested one website at a time for control-page reuse. Users can revoke them in Chrome extension settings.

Local records persist until users clear extension site data or uninstall the extension. Downloaded files remain on disk and must be managed separately. Pagekeeper does not permanently delete archives. Exported files may contain private page content; inspect them before sharing.

Questions: [GitHub Issues](https://github.com/amealf/pagekeeper/issues). Do not include private page content or credentials in issue reports.
