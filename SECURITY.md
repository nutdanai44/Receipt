# Security boundaries

This is a static GitHub Pages app. Google OAuth Client ID, spreadsheet ID and sheet name in config.js are public client configuration, not credentials. Moving them into a build-time secret and embedding them in browser JavaScript would still expose them to every visitor. A spreadsheet ID alone does not grant access to the file.

No OAuth client secret, service-account private key or refresh token belongs in this repository or in the deployed public files. If a future server needs credentials, store them in that server's secret manager and call it through an authenticated backend. Never return those secrets to browser code. GitHub Actions Secrets are for CI operations, not for hiding values in the published JavaScript.

The app obtains a short-lived Google access token after the user's consent. It is kept in this browser tab's sessionStorage to preserve the existing refresh-session behavior, is not committed to Git or sent to GitHub, and is cleared at expiry or logout. This is not an HttpOnly server session: same-origin JavaScript can read it. A backend is required to move token storage fully out of the browser.

Access to receipt data is enforced by Google Sheets sharing permissions and Google OAuth. Keep the spreadsheet restricted to the intended accounts and the authorized JavaScript origin restricted to the site's exact origin. Do not publish receipt exports into Pages.

The deployment workflow publishes only index.html, app.js and config.js. It runs security-check.cjs and schema.test.cjs first. The local scanner detects selected credential formats and sensitive file paths in the current tracked files; it is not a complete secret detector or a Git history audit. .gitignore reduces accidental additions but does not remove files already committed. If a real credential is exposed, revoke/rotate it first; deleting the latest file does not erase Git history.

Checks: node security-check.cjs, node --check app.js, node schema.test.cjs.
