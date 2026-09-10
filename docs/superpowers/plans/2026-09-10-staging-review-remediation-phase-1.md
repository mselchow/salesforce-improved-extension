# Staging Review Remediation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed runtime/DOM/manifest defects from the staging review and establish automated regression/quality gates before any dependency modernization.

**Architecture:** Keep content-script entrypoints thin and move testable behavior into focused feature modules. Replace install-time programmatic injection with static content scripts, use shared bounded/recurring DOM helpers for Salesforce asynchronous rendering, and verify behavior through Vitest/jsdom plus a built-manifest verification script.

**Tech Stack:** Chrome Manifest V3, CRXJS/Vite, JavaScript/TypeScript, React/Tailwind, Vitest, jsdom, ESLint, Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- GitHub `staging` at `ec8a76aa3c5d2e7414f1b6ae8afbe8b8bb9c544d` is the authoritative source; do not reconstruct Codex-only uncommitted changes.
- Already-open Salesforce tabs may require refresh after extension install/update; do not preserve programmatic reinjection.
- Content scripts fail open when expected Salesforce DOM is absent.
- Repeating SPA adjustments must be idempotent.
- Do not claim authenticated Salesforce smoke testing unless it was actually performed.
- Phase 2 dependency modernization must not begin until this plan's full `npm run check` gate passes.

---

## File Structure

**Create**
- `src/lib/observeMatches.js` — recurring scoped DOM observer.
- `src/features/popupMinimization.js` — idempotent docked-popup behavior.
- `src/features/flowSidebar.js` — idempotent Flow Builder sidebar behavior.
- `src/features/installedPackages.js` — testable Installed Packages initialization/sorting behavior.
- `src/features/loginPage.js` — testable login-page movement/sorting behavior.
- `tests/setup.js` — jsdom test cleanup.
- `tests/lib/waitForElement.test.js`
- `tests/lib/observeMatches.test.js`
- `tests/lib/addGlobalStyle.test.js`
- `tests/features/popupMinimization.test.js`
- `tests/features/flowSidebar.test.js`
- `tests/features/installedPackages.test.js`
- `tests/features/loginPage.test.js`
- `scripts/verify-manifest.mjs` — assertions against `dist/manifest.json`.
- `.github/workflows/check.yml` — project quality gate.

**Modify**
- `src/lib/waitForElement.js`
- `src/lib/addGlobalStyle.js`
- `src/scripts/general.js`
- `src/scripts/flowMainUI.js`
- `src/scripts/installedPackages.js`
- `src/scripts/loginPage.js`
- `src/scripts/flowDebugUI.js`
- `src/scripts/lightningPage.js`
- `manifest.ts`
- `src/App.tsx`
- `README.md`
- `components.json`
- `package.json`
- `package-lock.json`
- `.eslintrc.json` only if required for Vitest globals/config; prefer test-file environment comments/config over weakening production lint.

**Delete**
- `src/scripts/background.js`

---

### Task 1: Add the Vitest/jsdom regression harness and bounded DOM helpers

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/waitForElement.js`
- Create: `src/lib/observeMatches.js`
- Create: `tests/setup.js`
- Create: `tests/lib/waitForElement.test.js`
- Create: `tests/lib/observeMatches.test.js`

**Interfaces:**
- Produces: `waitForElement(selector, { root = document, timeoutMs = 10000, signal } = {}) => Promise<Element|null>`
- Produces: `observeMatches(selector, callback, { root = document, includeExisting = true } = {}) => () => void`

- [ ] **Step 1: Install the test dependencies and add the initial test script**

Run:
```bash
npm install --save-dev vitest jsdom
```

Change `package.json` scripts to include:
```json
"test": "vitest run --environment jsdom --setupFiles ./tests/setup.js"
```

- [ ] **Step 2: Create deterministic jsdom cleanup**

Create `tests/setup.js`:
```js
import { afterEach } from "vitest";

afterEach(() => {
  document.documentElement.innerHTML = "<head></head><body></body>";
});
```

- [ ] **Step 3: Write failing tests for bounded `waitForElement` behavior**

Create `tests/lib/waitForElement.test.js` covering immediate match, later insertion, timeout, and AbortSignal. Use fake timers only for timeout/abort cases.

Representative test:
```js
import { describe, expect, it, vi } from "vitest";
import waitForElement from "../../src/lib/waitForElement";

describe("waitForElement", () => {
  it("resolves an element inserted later", async () => {
    const promise = waitForElement(".target", { timeoutMs: 100 });
    const element = document.createElement("div");
    element.className = "target";
    document.body.appendChild(element);
    await expect(promise).resolves.toBe(element);
  });

  it("resolves null after timeout", async () => {
    vi.useFakeTimers();
    const promise = waitForElement(".missing", { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBeNull();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 4: Run the helper test to verify the current implementation fails**

Run:
```bash
npx vitest run tests/lib/waitForElement.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: timeout/AbortSignal cases fail because the current helper has no bounded cleanup/cancellation behavior.

- [ ] **Step 5: Implement bounded `waitForElement`**

Implement the approved contract in `src/lib/waitForElement.js`. Centralize terminal cleanup so observer, timeout, and abort listener are always removed. Query `root` immediately. For a `Document`, observe `root.documentElement ?? root`; for an `Element`, observe the element itself. `Document` is a valid MutationObserver target, so this covers the rare pre-documentElement case without a polling loop.

Core shape:
```js
export default function waitForElement(
  selector,
  { root = document, timeoutMs = 10000, signal } = {}
) {
  return new Promise((resolve) => {
    let observer;
    let timeoutId;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };

    const onAbort = () => finish(null);
    const find = () => root.querySelector(selector);
    const existing = find();
    if (existing) return finish(existing);
    if (signal?.aborted) return finish(null);

    signal?.addEventListener("abort", onAbort, { once: true });
    timeoutId = setTimeout(() => finish(null), timeoutMs);

    const observationRoot =
      root instanceof Document ? root.documentElement ?? root : root;

    observer = new MutationObserver(() => {
      const match = find();
      if (match) finish(match);
    });
    observer.observe(observationRoot, { childList: true, subtree: true });
  });
}
```

- [ ] **Step 6: Run the wait helper tests and confirm green**

```bash
npx vitest run tests/lib/waitForElement.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: PASS.

- [ ] **Step 7: Write failing tests for recurring observation**

Create `tests/lib/observeMatches.test.js` covering existing matches, newly inserted direct matches, newly inserted descendants, and cleanup preventing subsequent callbacks.

- [ ] **Step 8: Run observer tests to verify failure before implementation**

```bash
npx vitest run tests/lib/observeMatches.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL because `observeMatches.js` does not exist.

- [ ] **Step 9: Implement `observeMatches`**

Create `src/lib/observeMatches.js` with initial query processing, MutationObserver processing for added matching nodes and descendants, and a returned disconnect function. Use a `Set` only within each mutation batch to avoid invoking the callback twice for the same element when both paths find it.

- [ ] **Step 10: Run both DOM helper suites**

```bash
npx vitest run tests/lib/waitForElement.test.js tests/lib/observeMatches.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/waitForElement.js src/lib/observeMatches.js tests/setup.js tests/lib
git commit -m "test: add DOM regression harness"
```

---

### Task 2: Make runtime style insertion reliable and idempotent

**Files:**
- Modify: `src/lib/addGlobalStyle.js`
- Modify: `src/scripts/flowDebugUI.js`
- Modify: `src/scripts/flowMainUI.js`
- Modify: `src/scripts/loginPage.js`
- Modify: `src/scripts/installedPackages.js`
- Modify: `src/scripts/lightningPage.js`
- Create: `tests/lib/addGlobalStyle.test.js`

**Interfaces:**
- Consumes: `waitForElement()` from Task 1.
- Produces: `addGlobalStyle(css, { id } = {}) => Promise<HTMLStyleElement|null>`.

- [ ] **Step 1: Write failing tests for immediate, delayed, and duplicate-safe style insertion**

Tests must assert that a provided stable ID returns the same `<style>` element on repeated calls and that invocation before `<head>` exists eventually inserts once `<head>` appears.

- [ ] **Step 2: Verify red**

```bash
npx vitest run tests/lib/addGlobalStyle.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL because current helper is synchronous and silently returns without `<head>`.

- [ ] **Step 3: Implement the async/idempotent style helper**

Use `document.getElementById(id)` first; then use existing `document.head` or `waitForElement("head", { timeoutMs: 10000 })`; create `<style type="text/css">`, set `id` when supplied, assign `textContent`, append, and return it. Return `null` on bounded failure.

- [ ] **Step 4: Give each existing content-script style block a stable ID**

Use:
```text
salesforce-improved-flow-debug-styles
salesforce-improved-flow-main-styles
salesforce-improved-login-styles
salesforce-improved-installed-packages-styles
salesforce-improved-lightning-styles
```
Callers may fire-and-forget with `void addGlobalStyle(...)` because style failure is non-fatal.

- [ ] **Step 5: Run style tests**

```bash
npx vitest run tests/lib/addGlobalStyle.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/addGlobalStyle.js src/scripts tests/lib/addGlobalStyle.test.js
git commit -m "fix: harden runtime style injection"
```

---

### Task 3: Restore recurring popup minimization and Flow Builder sidebar adjustment

**Files:**
- Create: `src/features/popupMinimization.js`
- Create: `src/features/flowSidebar.js`
- Modify: `src/scripts/general.js`
- Modify: `src/scripts/flowMainUI.js`
- Create: `tests/features/popupMinimization.test.js`
- Create: `tests/features/flowSidebar.test.js`

**Interfaces:**
- Consumes: `observeMatches()` from Task 1.
- Produces: `minimizePopup(element)`, `initPopupMinimization()`.
- Produces: `adjustFlowSidebar(element)`, `initFlowSidebarAdjustment()`.

- [ ] **Step 1: Write popup tests first**

Use the exact current selectors:
```js
const POPUP_SELECTOR = "div.slds-docked_container.forceDockingPanel.DOCKED";
const POPUP_CONTENT_SELECTOR = "div.slds-docked-composer.slds-is-open";
```
Test existing, later-inserted, and repeated popup handling. Assert `DOCKED` becomes `MINIMIZED` and `slds-is-open` is removed.

- [ ] **Step 2: Verify popup tests fail**

```bash
npx vitest run tests/features/popupMinimization.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL before feature module exists.

- [ ] **Step 3: Implement popup feature and thin entrypoint**

`src/features/popupMinimization.js` exports selectors/functions and calls `observeMatches(POPUP_SELECTOR, minimizePopup, { includeExisting: true })`. `src/scripts/general.js` only imports/invokes `initPopupMinimization()`.

- [ ] **Step 4: Run popup tests green**

Run the same command; expected PASS.

- [ ] **Step 5: Write Flow sidebar tests first**

Use:
```js
const FLOW_SIDEBAR_SELECTOR =
  "builder_platform_interaction-container-common .editor div.slds-grid div.slds-col builder_platform_interaction-left-panel .left-panel";
```
Test delayed nested target creation and replacement with a new sidebar node. Assert `slds-size_medium` is removed and `slds-size_large` added on both.

- [ ] **Step 6: Verify Flow tests fail**

```bash
npx vitest run tests/features/flowSidebar.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL before feature module exists.

- [ ] **Step 7: Implement Flow sidebar feature and thin entrypoint**

`adjustFlowSidebar(sidebar)` performs only the two class operations. `initFlowSidebarAdjustment()` uses `observeMatches` on the final selector. Keep the existing style block in `src/scripts/flowMainUI.js`, then invoke the initializer.

- [ ] **Step 8: Run both feature suites**

```bash
npx vitest run tests/features/popupMinimization.test.js tests/features/flowSidebar.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/popupMinimization.js src/features/flowSidebar.js src/scripts/general.js src/scripts/flowMainUI.js tests/features
git commit -m "fix: restore recurring Salesforce UI adjustments"
```

---

### Task 4: Harden Installed Packages initialization and login-page DOM movement

**Files:**
- Create: `src/features/installedPackages.js`
- Create: `src/features/loginPage.js`
- Modify: `src/scripts/installedPackages.js`
- Modify: `src/scripts/loginPage.js`
- Create: `tests/features/installedPackages.test.js`
- Create: `tests/features/loginPage.test.js`

**Interfaces:**
- Consumes: `waitForElement()` from Task 1.
- Produces: `initInstalledPackages({ timeoutMs } = {}) => Promise<void>` plus exported transformation/sort helpers.
- Produces: `moveLoginsToRight()`, `moveSavedLoginsEditorToRight()`, `sortSavedUsernames()`, `initLoginPage()`.

- [ ] **Step 1: Write Installed Packages tests**

Create a representative `table.list` fixture with `tr.headerRow`, `tbody`, and data rows whose third column sorts out of order. Cover missing table timeout, asynchronous table insertion, default column-2 sort, rerun without nested anchors, and rerun without duplicate click handling. Use explicit data attributes for initialized/listener markers.

- [ ] **Step 2: Verify Installed Packages tests fail**

```bash
npx vitest run tests/features/installedPackages.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL before module exists/current script crashes on null table.

- [ ] **Step 3: Implement testable Installed Packages behavior**

Move table logic into `src/features/installedPackages.js`. Every helper receives the concrete `table` where applicable. `initInstalledPackages()` awaits `waitForElement("table.list", { timeoutMs })`, returns on null, then performs divider replacement, sortable marking, header conversion, listener setup, and `sortRows(table, 2)`. Guard absent `tbody`. Only wrap a header when its first child is not already an `<a>`.

- [ ] **Step 4: Make the script entrypoint thin**

Keep Installed Packages style injection in `src/scripts/installedPackages.js`, import `initInstalledPackages`, and call `void initInstalledPackages()`.

- [ ] **Step 5: Run Installed Packages tests green**

Run the same command; expected PASS.

- [ ] **Step 6: Write login feature tests**

Build fixtures for `#right #content`, `#manager`, `#chooser`, and saved login entries. Attach a click listener directly to `#manager` before movement; after movement, assert the exact same node is under `#right #content` and the listener still fires. Add a no-saved-logins test where `#right #content` is absent and assert no throw.

- [ ] **Step 7: Verify login tests fail**

```bash
npx vitest run tests/features/loginPage.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: FAIL because current implementation clones/removes `#manager` and dereferences a missing parent.

- [ ] **Step 8: Implement login feature module**

Move existing DOM functions without changing layout behavior. Replace clone/remove with `rightContainer.appendChild(savedLoginEditor)`. Guard a missing no-login message parent with early return. `initLoginPage()` awaits `#main` for movement and independently awaits `#idlist` for sorting. Preserve the current 500 ms delay only if a regression test demonstrates the delay is needed; otherwise remove it.

- [ ] **Step 9: Make login script entrypoint thin and retain style injection**

`src/scripts/loginPage.js` defines/injects styles, imports `initLoginPage`, and invokes it.

- [ ] **Step 10: Run both feature suites**

```bash
npx vitest run tests/features/installedPackages.test.js tests/features/loginPage.test.js --environment jsdom --setupFiles ./tests/setup.js
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/installedPackages.js src/features/loginPage.js src/scripts/installedPackages.js src/scripts/loginPage.js tests/features
git commit -m "fix: harden Salesforce DOM initialization"
```

---

### Task 5: Remove install-time injection and migrate Installed Packages routes

**Files:**
- Modify: `manifest.ts`
- Delete: `src/scripts/background.js`
- Create: `scripts/verify-manifest.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run verify:manifest`, reading `dist/manifest.json` and exiting nonzero on invariant failure.

- [ ] **Step 1: Create a failing built-manifest verifier before changing the manifest**

Create `scripts/verify-manifest.mjs` that asserts: no background service worker, no `scripting` permission, Installed Packages content script exists, and it contains `*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*`. Add `"verify:manifest": "node scripts/verify-manifest.mjs"`.

- [ ] **Step 2: Build and verify red**

```bash
npm run build && npm run verify:manifest
```
Expected: verifier fails because current manifest contains a background worker/`scripting` and lacks modern Setup route.

- [ ] **Step 3: Update `manifest.ts`**

Remove `permissions: ["scripting"]`, the background service worker, and `host_permissions` unless fresh code search finds another retained feature requiring them. Set Installed Packages matches exactly to:
```ts
matches: [
  "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
  "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
  "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
],
```
Retain `all_frames: true`.

- [ ] **Step 4: Delete `src/scripts/background.js`**

No replacement service worker is created.

- [ ] **Step 5: Rebuild and verify green**

```bash
npm run build && npm run verify:manifest
```
Expected: both commands exit 0.

- [ ] **Step 6: Inspect the built manifest manually**

```bash
cat dist/manifest.json
```
Confirm no background entry, no `scripting`, and all three intentional Installed Packages patterns are present.

- [ ] **Step 7: Commit**

```bash
git add manifest.ts package.json scripts/verify-manifest.mjs src/scripts/background.js
git commit -m "fix: remove install-time content script injection"
```

---

### Task 6: Fix popup accessibility/link behavior and documentation/config defects

**Files:**
- Modify: `src/App.tsx`
- Modify: `README.md`
- Modify: `components.json`

**Interfaces:**
- No new shared interfaces.

- [ ] **Step 1: Update popup icon sizing/accessibility**

Replace the image with:
```tsx
<img src={icon} className="w-12 h-12" alt="Salesforce Improved" />
```

- [ ] **Step 2: Open the GitHub link in a normal tab**

Use an explicit click handler calling:
```tsx
chrome.tabs.create({
  url: "https://github.com/mselchow/salesforce-improved-extension",
});
```
and prevent the anchor's default popup navigation. Do not add `tabs` permission.

- [ ] **Step 3: Correct README unpacked-extension instructions**

State that `npm run build` produces `dist`, and Load unpacked should select `dist`. Do not tell users to load `src` after `npm run dev`. Add the refresh-after-install/update note.

- [ ] **Step 4: Correct shadcn stylesheet configuration**

Change `components.json` to `"css": "src/styles/globals.css"`.

- [ ] **Step 5: Run typecheck/build smoke checks**

```bash
npx tsc --noEmit
npm run build
```
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx README.md components.json
git commit -m "fix: clean up popup and project documentation"
```

---

### Task 7: Enforce project quality gates locally and in GitHub Actions

**Files:**
- Modify: `package.json`
- Modify: `.eslintrc.json` only if necessary
- Create: `.github/workflows/check.yml`
- Potential formatting changes: files reported by `prettier --check .`

**Interfaces:**
- Produces: `npm run check` as the canonical local/CI gate.

- [ ] **Step 1: Add exact quality scripts**

Set scripts to include:
```json
"test": "vitest run --environment jsdom --setupFiles ./tests/setup.js",
"typecheck": "tsc --noEmit",
"lint": "eslint --ext .js,.ts,.tsx .",
"format": "prettier --write .",
"format:check": "prettier --check .",
"verify:manifest": "node scripts/verify-manifest.mjs",
"check": "npm run test && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run verify:manifest"
```

- [ ] **Step 2: Run expanded lint and fix actual errors**

```bash
npm run lint
```
Fix each error without disabling rules globally unless the rule is demonstrably inappropriate. For UI files scheduled for Phase 2 deletion, make only the minimal lint correction now.

- [ ] **Step 3: Run Prettier check and isolate formatting-only cleanup**

```bash
npm run format:check
```
If it fails, run `npm run format`, review `git diff` for formatting-only changes, and commit those separately as `style: normalize project formatting`.

- [ ] **Step 4: Create CI workflow**

Create `.github/workflows/check.yml`:
```yaml
name: Check

on:
  pull_request:
    branches: [staging, main]
  push:
    branches: [staging, main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
```

- [ ] **Step 5: Run the complete fresh local gate**

```bash
npm run check
```
Expected: all tests pass; typecheck, lint, format check, build, and manifest verification exit 0.

- [ ] **Step 6: Commit gate configuration**

```bash
git add package.json package-lock.json .eslintrc.json .github/workflows/check.yml
git commit -m "chore: enforce project quality gates"
```
Omit unchanged files.

---

### Task 8: Phase 1 completion verification and handoff

**Files:**
- No production changes expected.

**Interfaces:**
- Produces the verified baseline required by the Phase 2 plan.

- [ ] **Step 1: Run the full gate from a clean working tree**

```bash
npm run check
```
Record exact test count and exit status.

- [ ] **Step 2: Verify repository diff against `staging`**

```bash
git diff --check staging...HEAD
git diff --stat staging...HEAD
git status --short
```
Expected: `git diff --check` exits 0 and working tree is clean.

- [ ] **Step 3: Re-read approved acceptance criteria**

Confirm every Phase 1 criterion in the design spec maps to implemented code/tests. Do not substitute a green test suite for requirement review.

- [ ] **Step 4: Document manual Salesforce smoke-test status accurately**

If authenticated access exists, manually test ordinary Lightning, Setup home, App Builder, Flow Builder, Flow Debug, Installed Packages, and login/saved-login pages. Otherwise record exactly that authenticated smoke testing was not performed and live selectors/routes remain for manual verification.

- [ ] **Step 5: Stop before Phase 2**

Do not begin dependency/toolchain modernization unless explicitly instructed to continue with the separate Phase 2 plan.
