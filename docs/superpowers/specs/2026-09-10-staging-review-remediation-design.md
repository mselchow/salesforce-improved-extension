# Staging Review Remediation Design

**Date:** 2026-09-10  
**Base branch:** `staging`  
**Authoritative source:** GitHub `staging` branch at commit `ec8a76aa3c5d2e7414f1b6ae8afbe8b8bb9c544d`

## Purpose

Remediate the defects and maintainability issues identified during review of the Salesforce Improved extension without reconstructing or depending on uncommitted local changes that are not present in GitHub.

The work is split into two independently reviewable phases:

1. **Runtime reliability and project gates** — fix browser/content-script behavior, Salesforce route coverage, DOM lifecycle handling, popup/documentation defects, and add automated regression protection.
2. **Dependency/toolchain modernization** — remove unused UI/dependency surface first, then upgrade the remaining build stack in controlled steps while preserving behavior established by Phase 1 tests.

## Source-of-truth decision

GitHub `staging` is authoritative for implementation.

The Codex report referenced local uncommitted changes that are not present in GitHub, including:

- a partial `salesforce-setup.com` manifest migration;
- a malformed login-page CSS edit.

Those local edits are **not** to be recreated or merged by inference. The implementation starts from GitHub `staging` and applies the design below directly.

## Goals

- Eliminate the install/update service-worker injection failure.
- Restore popup minimization for existing and newly opened Salesforce docked popups.
- Support the modern Salesforce Setup domain and Installed Packages Lightning route.
- Prevent content-script crashes when expected DOM is missing or delayed.
- Make DOM waiting bounded and compatible with Salesforce SPA/asynchronous rendering.
- Preserve Salesforce-owned DOM event listeners/state when relocating login-page elements.
- Make runtime stylesheet insertion reliable when scripts execute at `document_start`.
- Add deterministic automated regression tests for the defects above.
- Strengthen lint/type/format/build gates and verify the generated extension manifest.
- Fix small popup and documentation defects discovered by the review.
- Reduce stale dependency risk through a separate, test-protected modernization phase.

## Non-goals

- Reimplement uncommitted local working-tree changes from the Codex machine.
- Add a new settings/options feature.
- Redesign the popup or login page beyond fixes required by the review.
- Add broad Playwright/Puppeteer browser automation in Phase 1.
- Guarantee compatibility with undocumented Salesforce DOM variants that cannot be represented by current known selectors.
- Preserve seamless reinjection into already-open tabs after extension install/update. Users may need to refresh an already-open Salesforce tab after installing or updating the extension.
- Refactor unrelated extension features.

## External platform assumptions

### Salesforce Setup domain

Salesforce is migrating Lightning Setup pages to `*.salesforce-setup.com`. Current documented production and sandbox formats include:

- `[MyDomain].my.salesforce-setup.com/lightning/setup/...`
- `[MyDomain]--[Sandbox].sandbox.my.salesforce-setup.com/lightning/setup/...`

The Installed Packages Lightning route is `/lightning/setup/ImportedPackage/home`.

The extension must therefore match the Setup domain directly rather than relying on redirects from older Lightning or Classic URLs.

### Chrome extension behavior

All runtime page modifications are already declared through static `content_scripts`. Programmatic reinjection is not required for correctness and introduces extra permission, host-permission, error-handling, frame, and duplicate-execution complexity.

## Phase 1 architecture: runtime reliability and project gates

### 1. Remove install/update programmatic reinjection

Delete `src/scripts/background.js` and remove the manifest background service worker entry.

Remove the `scripting` permission.

Remove `host_permissions` unless another retained extension feature is discovered to require them. Static content scripts receive access through their `matches` patterns and do not require the separate host-permission list used by `chrome.scripting.executeScript()`.

**Behavioral consequence:** already-open Salesforce tabs are not forcibly updated after extension installation/update. A page refresh loads the new static content script version.

This is intentional and must be documented in README troubleshooting/development notes if useful.

### 2. Manifest route model

Keep content-script match patterns narrow and feature-specific.

For Installed Packages, support:

- `*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*`
- `*://*.lightning.force.com/lightning/setup/ImportedPackage/home*` for orgs still serving Setup from the Lightning domain during transition
- `*://*.salesforce.com/0A3?setupid=ImportedPackage*` only as legacy Salesforce Classic compatibility

The modern Setup-domain pattern is primary.

Do not create a broad catch-all Setup content script solely to compensate for missing route knowledge.

A manifest test must assert that the Installed Packages script includes the modern Setup-domain route and that no background service worker or `scripting` permission remains.

### 3. DOM lifecycle utilities

Replace the current unbounded `waitForElement(selector)` helper with a bounded helper whose public contract is:

```js
waitForElement(selector, options?) => Promise<Element | null>
```

Supported options:

```js
{
  root?: Document | Element,
  timeoutMs?: number,
  signal?: AbortSignal
}
```

Defaults:

- `root`: `document`
- `timeoutMs`: `10000`

Behavior:

1. Return the matching element immediately if already present.
2. Otherwise observe DOM additions beneath the root.
3. Resolve with the element when it appears.
4. Resolve with `null` when the timeout elapses.
5. Resolve with `null` and disconnect if an AbortSignal aborts.
6. Always disconnect the MutationObserver and clear timers/listeners on every terminal path.
7. If observation cannot start because a suitable root node is not yet available, defer observation until `document.documentElement` exists rather than observing `document.body` unconditionally.

Create a separate recurring observer helper for behaviors that intentionally need to reapply after Salesforce SPA rerenders:

```js
observeMatches(selector, callback, options?) => () => void
```

Supported options:

```js
{
  root?: Document | Element,
  includeExisting?: boolean
}
```

Behavior:

- invoke `callback(element)` once for each currently matching element when `includeExisting` is true;
- observe added DOM nodes and invoke the callback for matching added nodes and matching descendants;
- do not track global mutation state beyond the selected root;
- return a cleanup function that disconnects the observer.

The caller is responsible for making each callback operation idempotent.

### 4. Popup minimization

`general.js` must stop passing a callback to `waitForElement()`.

Instead:

1. define one idempotent `minimizePopup(popup)` operation;
2. process existing docked popups immediately;
3. observe subsequent matching docked popup/container additions;
4. minimize only when the popup contains an open composer matching the existing popup-content selector;
5. repeated observation of an already-minimized popup must be harmless.

The behavior must cover popups created after page initialization, not just the first rendered set.

### 5. Installed Packages initialization

`installedPackages.js` must not initialize against a nullable table reference.

Initialization flow:

1. wait for `table.list` using the bounded DOM helper;
2. if the table never appears, exit without throwing;
3. perform all transformation/sorting operations against that concrete table root;
4. guard absent `tbody`, header rows, and cells;
5. make header-link wrapping idempotent so rerunning initialization cannot nest anchors;
6. attach at most one sorter click listener per table;
7. preserve the script's current default alphabetical sort by column index 2.

The implementation may mark initialized elements with `data-salesforce-improved-*` attributes to provide explicit idempotency.

### 6. Flow Builder sidebar resilience

Do not wait for the outer `builder_platform_interaction-left-panel` element and then synchronously search for `.left-panel`.

Instead observe/wait for the final effective target within the Flow Builder DOM:

```text
builder_platform_interaction-container-common
  .editor
  div.slds-grid
  div.slds-col
  builder_platform_interaction-left-panel
  .left-panel
```

When the target appears:

- remove `slds-size_medium`;
- add `slds-size_large`.

The operation is idempotent and must reapply to replacement sidebar nodes after Salesforce rerenders the component.

### 7. Login-page DOM movement

`moveSavedLoginsEditorToRight()` must move the original `#manager` node instead of `cloneNode(true)` plus removal.

This preserves Salesforce-owned event listeners, element identity, and transient state.

The no-saved-logins branch in `sortSavedUsernames()` must guard the `#right #content` parent before assigning `innerHTML`.

Existing login-page layout behavior remains otherwise unchanged.

### 8. Reliable style insertion

Retain the `addGlobalStyle(css)` JavaScript helper in Phase 1 rather than migrating all rules into separate manifest CSS assets at the same time as the behavioral fixes.

Change its contract to support reliable/idempotent insertion:

```js
addGlobalStyle(css, options?) => Promise<HTMLStyleElement | null>
```

Supported option:

```js
{ id?: string }
```

Behavior:

- if a style element with the requested `id` already exists, return it without duplicating styles;
- if `<head>` exists, append immediately;
- if `<head>` does not exist, wait for it/document structure to become available with a bounded mechanism and then append;
- never silently abandon style insertion solely because execution occurred at `document_start`;
- resolve `null` if insertion cannot be completed within the bounded wait.

Callers should provide stable IDs for injected style blocks so reruns cannot duplicate them.

### 9. Popup UI cleanup

In `src/App.tsx`:

- replace invalid Tailwind `w-50 h-50` classes with valid explicit sizing;
- add descriptive `alt` text to the extension icon;
- make the GitHub link open intentionally in a normal browser tab rather than navigating the extension popup;
- retain current settings-button behavior.

No visual redesign is included.

### 10. Documentation/config cleanup

Update README build/development instructions so the user loads the actual CRXJS-generated unpacked extension directory rather than `src`.

Correct `components.json` from `src/globals.css` to `src/styles/globals.css` if the file remains after Phase 2 pruning.

If Phase 2 removes shadcn configuration entirely, delete `components.json` instead of preserving a corrected but unused file.

### 11. Automated tests

Add Vitest with jsdom for Phase 1 regression testing.

Tests must cover at minimum:

#### DOM helper tests

- immediate resolution when a selector already exists;
- asynchronous resolution after element insertion;
- timeout returns `null` and disconnects;
- AbortSignal returns `null` and disconnects;
- recurring observer handles existing and newly added matches;
- cleanup stops subsequent callbacks.

#### Popup tests

- existing open docked popup is minimized;
- popup inserted after initialization is minimized;
- rerunning/duplicate observation does not corrupt classes.

#### Installed Packages tests

- missing table does not throw;
- asynchronously inserted table initializes;
- default sorting still uses column 2;
- repeated initialization does not nest header anchors;
- repeated initialization does not attach duplicate click behavior.

#### Login tests

- `#manager` is physically moved, not cloned;
- an event listener attached before movement still fires afterward;
- absent no-login parent does not throw.

#### Flow Builder tests

- nested `.left-panel` appearing after the outer component is adjusted;
- a replacement sidebar rendered later is also adjusted;
- repeated adjustment is harmless.

#### Style tests

- style inserts when `<head>` already exists;
- style inserts when `<head>` appears after helper invocation;
- stable style ID prevents duplicates.

#### Manifest tests

- no background service worker exists;
- `scripting` permission is absent;
- Installed Packages includes `salesforce-setup.com/lightning/setup/ImportedPackage/home*`;
- legacy/transition patterns remain only where intentionally supported.

#### Popup component tests

A lightweight render/unit test is optional. Static lint/type checks are sufficient for the small accessibility/link changes unless implementation introduces behavior requiring a unit test.

### 12. Project gates

Add scripts that separately support:

- `test`
- `typecheck`
- `lint`
- `format:check`
- `build`
- a combined `check` command

Lint must cover `.js`, `.ts`, and `.tsx`.

The combined local/CI gate must run:

1. Vitest tests;
2. `tsc --noEmit`;
3. ESLint for JS/TS/TSX;
4. Prettier check;
5. production Vite build;
6. generated-manifest verification.

Add a GitHub Actions workflow that runs the same gate on pull requests and pushes to the implementation branch/main integration branches as appropriate.

Formatting-only cleanup required to make the Prettier gate pass may be included, but it should be isolated in its own commit when it touches unrelated files.

## Phase 2 architecture: dependency/toolchain modernization

Phase 2 begins only after Phase 1 behavioral tests and gates are green.

### 1. Prune unused application/UI surface first

The options page currently contains placeholder copy and the popup only requires a simple settings action.

Remove unused shadcn/form/switch/toast infrastructure where code search confirms it has no retained consumer.

Candidates include unused files under `src/components/ui/` and packages such as:

- `@hookform/resolvers`
- unused Radix packages
- `react-hook-form`
- `zod`
- `lucide-react`
- `class-variance-authority`
- `tailwind-merge`
- `tailwindcss-animate`
- other packages whose only consumers are deleted unused components

Do not remove React, CRXJS, Vite, Tailwind, TypeScript, or dependencies still required by retained popup/options code.

If the shared Button component is only used by the popup, replace it with a native styled `<button>` before deleting its dependency chain.

### 2. Upgrade in controlled compatibility steps

Upgrade the remaining toolchain in small groups rather than one wholesale lockfile jump.

Recommended order:

1. CRXJS/Vite compatibility pair;
2. TypeScript and type packages;
3. ESLint/typescript-eslint/import resolver stack;
4. React/Tailwind/PostCSS support packages if needed;
5. remaining small runtime dependencies.

For each group:

- update only that compatibility set;
- run the full Phase 1 `check` gate;
- inspect generated manifest/build output;
- commit before moving to the next group.

Choose the newest mutually compatible stable versions available at implementation time. Do not force a newest-major package when peer dependency constraints make the combination unsupported.

### 3. Audit interpretation

`npm audit` findings in build/dev dependencies are not automatically treated as shipped extension vulnerabilities.

After pruning/upgrading:

- run `npm audit` again;
- record remaining advisories;
- distinguish runtime-shipped exposure from development/build-only exposure;
- do not use `npm audit fix --force` if it causes unsupported major upgrades or breaks the verified toolchain.

## Error-handling principles

- Content scripts must fail open: absence of an expected Salesforce DOM target should result in no modification, not an uncaught exception.
- DOM helpers must clean up observers/timers on success, timeout, cancellation, and explicit cleanup.
- Repeating an intentional SPA adjustment must be safe.
- Do not log noisy errors for expected missing selectors after bounded timeout; reserve console warnings/errors for genuinely exceptional internal failures.

## Idempotency model

Idempotency is required where behavior can intentionally repeat during one page lifecycle:

- popup minimization;
- Flow Builder sidebar adjustment;
- Installed Packages initialization if invoked again;
- style insertion.

Arbitrary whole-extension double execution after an update is not a design requirement because programmatic reinjection is removed.

## Verification strategy

### Automated

The Phase 1 `check` command is the required pre-merge gate.

The generated manifest must be inspected/tested rather than assuming source manifest compilation preserves intended matches/permissions.

### Manual browser smoke test

After automated verification, load the built extension in Chrome and smoke test, when authenticated Salesforce access is available:

- ordinary Lightning page;
- Setup home on the current Setup domain;
- Lightning App Builder;
- Flow Builder;
- Flow Debug;
- Installed Packages;
- Salesforce login/saved-login page.

For install/update behavior:

1. leave representative Salesforce tabs open;
2. install/update the extension;
3. confirm there is no service-worker injection exception because no programmatic injector exists;
4. refresh the tabs;
5. confirm each applicable static content script takes effect once.

If authenticated live Salesforce access is unavailable during implementation, this smoke test remains a documented manual verification item and must not be represented as completed.

## Commit/PR structure

Recommended commits for Phase 1:

1. `test: add DOM regression harness`
2. `fix: remove install-time content script injection`
3. `fix: harden DOM lifecycle helpers`
4. `fix: restore recurring Salesforce UI adjustments`
5. `fix: harden login and installed package DOM handling`
6. `fix: support modern Salesforce setup routes`
7. `fix: clean up popup and project documentation`
8. `chore: enforce project quality gates`
9. optional isolated formatting commit if required

Recommended Phase 2 commits:

1. `refactor: remove unused UI dependencies`
2. one commit per dependency compatibility group
3. `chore: document remaining dependency audit findings`

Phase 1 and Phase 2 should be separate pull requests or, at minimum, separate clearly reviewable commit ranges. Phase 2 must not begin until Phase 1 tests establish the behavioral baseline.

## Acceptance criteria

Phase 1 is complete when:

- no background programmatic injector remains;
- no `scripting` permission remains;
- popup minimization works for existing and newly opened docked popups in tests;
- Installed Packages script exits safely when the table is missing and initializes when it appears later;
- the manifest covers the modern `salesforce-setup.com` Installed Packages route;
- Flow Builder sidebar changes survive delayed render and replacement render in tests;
- login editor movement preserves original node identity/listeners;
- style insertion works when invoked before `<head>` exists;
- lint covers JS/TS/TSX;
- tests, typecheck, lint, format check, build, and generated-manifest verification are all available through the project gate;
- README/build instructions and popup defects are corrected;
- no claim of live Salesforce verification is made unless the corresponding manual smoke tests were actually executed.

Phase 2 is complete when:

- unused UI/dependency surface is removed;
- the remaining dependency graph is upgraded to a supported stable compatibility set;
- the full Phase 1 gate still passes after each upgrade group;
- the final `npm audit` result is recorded and remaining advisories are classified rather than blindly force-fixed.

## References

- Salesforce Help: New Setup Domain Rollout FAQ — https://help.salesforce.com/s/articleView?id=001395243&language=en_US&type=1
- Salesforce Help: My Domain Login and Application URL Formats — https://help.salesforce.com/s/articleView?id=sf.domain_name_url_formats.htm&language=en_US&type=5
- Chrome Extensions: `chrome.scripting` — https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chrome Extensions: Content scripts — https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
