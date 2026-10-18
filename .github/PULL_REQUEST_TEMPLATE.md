<!-- Thanks for the PR! Keep it small, focused, and tested. -->

## What does this PR change?

<!-- A clear, brief description. Screenshots welcome for visual changes. -->

## Why?

<!-- The problem it solves or the value it adds. Link the issue it closes. -->

Closes #

## How was it tested?

- [ ] Built with `node _build2/build.js` (and/or `build.ps1`)
- [ ] Browser console is clean (zero errors, zero warnings)
- [ ] Model report: `SA.mdl3d.ready === true` and `SA.mdl3d.bad` is empty
- [ ] Played the affected area (on foot + vehicle; flew/rode swapped vehicles if touched)
- [ ] Save/load round-trip after gameplay changes
- [ ] Performance sanity in the densest view (`renderer.info.render.calls` before/after if relevant)

Notes / before-after evidence:

<!-- Paste console output, screenshots, or numbers here. -->

## Checklist

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] No new runtime dependencies (or an issue was discussed first)
- [ ] If assets were added/changed: [CREDITS.md](../CREDITS.md) updated with author + license + link
- [ ] `index1.html` rebuilt and committed (if the change affects the game)
