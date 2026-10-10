# Security policy

Supported preview: 0.1.x. Please report security issues through [GitHub private vulnerability reporting](https://github.com/amealf/pagekeeper/security/advisories/new). If unavailable, open an issue requesting a private contact channel without posting exploit details or private content.

Profiles are JSON configuration, not executable code. The extension has no external messaging API, wildcard mandatory host permission, debugger, native messaging, cookie access, telemetry, or remote scripts. Content-script commands are accepted only from this extension. The worker accepts control requests only from its own control page. Exports use inert HTML with a restrictive CSP.

The Chrome Web Store has not reviewed this preview. Real site profiles require calibration and users must comply with their access rights and site rules.
