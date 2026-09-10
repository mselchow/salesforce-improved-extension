# Staging Review Runtime Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development for production-code changes and superpowers:verification-before-completion before every commit or completion claim.

**Goal:** Fix the confirmed browser/content-script defects from the staging review, add modern Salesforce Setup routing, and establish deterministic automated project gates without changing unrelated product behavior.

**Architecture:** Remove the install/update programmatic injector and rely exclusively on static content scripts. Introduce one bounded DOM-wait helper and one recurring DOM-observer helper. Put testable feature behavior in side-effect-free modules under `src/features/`; keep `src/scripts/*` as thin content-script entrypoints that inject styles and start those features. Add Vitest/jsdom regression coverage, generated-manifest verification, and CI before any dependency/toolchain modernization.

**Tech Stack:** Chrome Manifest V3, CRXJS/Vite, JavaScript content scripts, React/TypeScript popup/options UI, Vitest 0.34.6, jsdom 22.1.0, ESLint, Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- GitHub `staging` at `ec8a76aa3c5d2e7414f1b6ae8afbe8b8bb9c544d` is the authoritative product source; do not reconstruct Codex-only uncommitted edits.
- Execute this plan in an isolated worktree on branch `fix/staging-review-runtime-reliability`, created from the latest `fix/staging-review-remediation` commit.
- Do not preserve seamless programmatic reinjection into already-open Salesforce tabs; users may refresh tabs after install/update.
- Content scripts must fail open when expected Salesforce DOM is absent.
- Intentional repeated SPA behavior must be idempotent.
- Feature modules imported by tests must not auto-start observers, timers, or page modifications. Side effects belong only in thin `src/scripts/*` entrypoints.
- When a test targets a brand-new module, a module-resolution error does **not** count as TDD RED. The task provides an inert importable stub; create only that stub, rerun until a behavioral assertion fails, and only then implement behavior.
- Do not add Playwright/Puppeteer in Phase 1.
- Do not begin dependency/toolchain modernization until this plan's full `npm run check` gate passes and the Phase 1 result is reviewed as the behavioral baseline.
- Do not claim authenticated Salesforce smoke testing was completed unless it was actually performed.

---

## File Structure

### Files created

- `vitest.config.ts` — Vitest/jsdom configuration and `@` alias.
- `src/lib/observeMatches.js` — recurring MutationObserver helper for Salesforce SPA rerenders.
- `src/features/popupMinimizer.js` — side-effect-free popup behavior.
- `src/features/flowSidebar.js` — side-effect-free Flow Builder sidebar behavior.
- `src/features/installedPackages.js` — side-effect-free Installed Packages table behavior.
- `src/features/loginPage.js` — side-effect-free login-page DOM transformations.
- `tests/waitForElement.test.js`
- `tests/observeMatches.test.js`
- `tests/addGlobalStyle.test.js`
- `tests/popupMinimizer.test.js`
- `tests/flowSidebar.test.js`
- `tests/installedPackages.test.js`
- `tests/loginPage.test.js`
- `tests/manifest.test.ts`
- `scripts/verify-manifest.mjs`
- `.github/workflows/check.yml`

### Files modified

- `package.json` / `package-lock.json`
- `manifest.ts`
- `src/lib/waitForElement.js`
- `src/lib/addGlobalStyle.js`
- `src/scripts/general.js`
- `src/scripts/flowMainUI.js`
- `src/scripts/installedPackages.js`
- `src/scripts/loginPage.js`
- `src/scripts/flowDebugUI.js`
- `src/scripts/lightningPage.js`
- `src/App.tsx`
- `README.md`
- `components.json`
- `.eslintrc.json` only if required to make the broadened Phase 1 lint gate legitimately pass.

### File deleted

- `src/scripts/background.js`

---

### Task 1: Establish the DOM regression harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/harness.test.js`

**Interfaces:**
- Produces: `npm test` using Vitest/jsdom with `@` mapped to `src/`.

- [ ] **Step 1: Write the harness test before installing the harness**

Create `tests/harness.test.js`:

```js
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs with a DOM", () => {
    document.body.innerHTML = '<div id="fixture">ready</div>';
    expect(document.querySelector("#fixture")?.textContent).toBe("ready");
  });
});
```

- [ ] **Step 2: Verify the project cannot run the test yet**

```bash
npm test
```

Expected: npm reports no `test` script. This establishes the missing test gate; this setup task is infrastructure, not product behavior.

- [ ] **Step 3: Install only the Phase 1-compatible test dependencies**

```bash
npm install --save-dev vitest@0.34.6 jsdom@22.1.0
```

Do not upgrade Vite, CRXJS, TypeScript, ESLint, React, or other existing packages.

- [ ] **Step 4: Add Vitest configuration and the test script**

Create `vitest.config.ts`:

```ts
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    clearMocks: true,
    restoreMocks: true,
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 5: Verify the harness and existing build**

```bash
npm test -- tests/harness.test.js
npm run build
```

Expected: one test passes; build exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/harness.test.js
git commit -m "test: add DOM regression harness"
```

---

### Task 2: Remove install-time reinjection and modernize Installed Packages routes

**Files:**
- Modify: `manifest.ts`
- Delete: `src/scripts/background.js`
- Create: `tests/manifest.test.ts`

**Interfaces:**
- Produces: `buildManifest(env: { mode: string })` for deterministic testing and CRXJS wrapping.
- Removes: `background`, `scripting`, and `host_permissions`.
- Adds Installed Packages matches for Setup domain, transitional Lightning domain, and legacy Classic route.

- [ ] **Step 1: Write failing manifest tests**

Create `tests/manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildManifest } from "../manifest";

const installedPackagesMatches = [
  "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
  "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
  "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
];

describe("extension manifest", () => {
  it("does not use install-time programmatic injection", () => {
    const manifest = buildManifest({ mode: "test" });

    expect(manifest.background).toBeUndefined();
    expect(manifest.permissions ?? []).not.toContain("scripting");
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("matches Installed Packages on current and transitional routes", () => {
    const manifest = buildManifest({ mode: "test" });
    const script = manifest.content_scripts?.find((entry) =>
      entry.js?.includes("src/scripts/installedPackages.js"),
    );

    expect(script).toBeDefined();
    expect(script?.matches).toEqual(expect.arrayContaining(installedPackagesMatches));
    expect(script?.all_frames).toBe(true);
  });
});
```

- [ ] **Step 2: Run and establish RED**

```bash
npm test -- tests/manifest.test.ts
```

The initial import will fail because `buildManifest` does not exist. That is a test setup error, not RED. Add only this export around the current manifest object construction so the test can execute without changing permissions/routes yet:

```ts
interface ManifestEnvironment {
  mode: string;
}
```

Refactor the existing inline object into `export function buildManifest(env: ManifestEnvironment) { return { CURRENT_EXISTING_MANIFEST_FIELDS }; }` **by moving the existing fields unchanged**, then wrap it with `defineManifest((env) => buildManifest(env))`. Do not fix the manifest values during this setup refactor. Rerun the test.

Expected behavioral RED after the refactor: assertions fail because background/scripting/host permissions remain and modern Installed Packages matches are absent.

- [ ] **Step 3: Apply the minimal manifest behavior change**

Keep all unrelated fields/content-script entries unchanged. Remove:

```ts
permissions: ["scripting"],
```

Remove the entire `background` block and the entire `host_permissions` array.

Replace the Installed Packages `matches` array with:

```ts
matches: [
  "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
  "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
  "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
],
```

Keep `run_at: "document_idle"` and `all_frames: true`.

- [ ] **Step 4: Delete the obsolete injector**

```bash
git rm src/scripts/background.js
```

- [ ] **Step 5: Verify GREEN, typecheck, and build**

```bash
npm test -- tests/manifest.test.ts
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Inspect built manifest explicitly**

```bash
node --input-type=module -e 'import fs from "node:fs"; const m=JSON.parse(fs.readFileSync("dist/manifest.json","utf8")); console.log(JSON.stringify({background:m.background,permissions:m.permissions,host_permissions:m.host_permissions,content_scripts:m.content_scripts},null,2))'
```

Expected: no background, no scripting permission, no host permissions; Installed Packages has all three intended matches.

- [ ] **Step 7: Commit**

```bash
git add manifest.ts tests/manifest.test.ts
git commit -m "fix: remove install-time content script injection"
```

---

### Task 3: Replace unbounded DOM waiting and add recurring match observation

**Files:**
- Modify: `src/lib/waitForElement.js`
- Create: `src/lib/observeMatches.js`
- Create: `tests/waitForElement.test.js`
- Create: `tests/observeMatches.test.js`

**Interfaces:**
- `waitForElement(selector, { root = document, timeoutMs = 10000, signal }?) => Promise<Element | null>`.
- `observeMatches(selector, callback, { root = document, includeExisting = true }?) => () => void`.

- [ ] **Step 1: Write preservation + new behavior tests for `waitForElement`**

Create `tests/waitForElement.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import waitForElement from "@/lib/waitForElement";

describe("waitForElement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves an existing element", async () => {
    document.body.innerHTML = '<div class="target"></div>';
    await expect(waitForElement(".target")).resolves.toBe(
      document.querySelector(".target"),
    );
  });

  it("resolves an element inserted later", async () => {
    const promise = waitForElement(".target", { timeoutMs: 100 });
    const target = document.createElement("div");
    target.className = "target";
    document.body.append(target);
    await expect(promise).resolves.toBe(target);
  });

  it("settles with null after timeout", async () => {
    vi.useFakeTimers();
    let value = "pending";
    const promise = waitForElement(".target", { timeoutMs: 25 }).then(
      (result) => {
        value = result;
      },
    );

    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();

    try {
      expect(value).toBeNull();
    } finally {
      const cleanupTarget = document.createElement("div");
      cleanupTarget.className = "target";
      document.body.append(cleanupTarget);
      await Promise.resolve();
      await promise;
    }
  });

  it("settles with null when aborted", async () => {
    let value = "pending";
    const controller = new AbortController();
    const promise = waitForElement(".target", {
      timeoutMs: 1000,
      signal: controller.signal,
    }).then((result) => {
      value = result;
    });

    controller.abort();
    await Promise.resolve();

    try {
      expect(value).toBeNull();
    } finally {
      const cleanupTarget = document.createElement("div");
      cleanupTarget.className = "target";
      document.body.append(cleanupTarget);
      await Promise.resolve();
      await promise;
    }
  });

  it("uses the supplied root and can begin before its documentElement exists", async () => {
    const root = document.implementation.createDocument(null, null);
    const promise = waitForElement(".target", { root, timeoutMs: 100 });
    const html = root.createElement("html");
    const body = root.createElement("body");
    const target = root.createElement("div");
    target.setAttribute("class", "target");
    body.append(target);
    html.append(body);
    root.append(html);

    await expect(promise).resolves.toBe(target);
  });
});
```

- [ ] **Step 2: Run and establish behavioral RED**

```bash
npm test -- tests/waitForElement.test.js
```

Expected: existing/immediate cases pass, while timeout/abort/root behavior fails. The `finally` cleanup prevents the legacy observer from remaining pending after failed assertions.

- [ ] **Step 3: Implement bounded wait**

Replace `src/lib/waitForElement.js` with:

```js
const DEFAULT_TIMEOUT_MS = 10_000;

function isDocument(root) {
  return root?.nodeType === Node.DOCUMENT_NODE;
}

function getObservationTarget(root) {
  return isDocument(root) ? root.documentElement : root;
}

export default function waitForElement(
  selector,
  { root = document, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {},
) {
  return new Promise((resolve) => {
    let observer = null;
    let rootObserver = null;
    let timer = null;
    let abortHandler = null;
    let settled = false;

    const findMatch = () => root.querySelector(selector);

    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      rootObserver?.disconnect();
      if (timer !== null) clearTimeout(timer);
      if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
      resolve(value);
    };

    const existing = findMatch();
    if (existing) {
      finish(existing);
      return;
    }

    if (signal?.aborted) {
      finish(null);
      return;
    }

    const startObserver = () => {
      const target = getObservationTarget(root);
      if (!target) return false;

      observer = new MutationObserver(() => {
        const match = findMatch();
        if (match) finish(match);
      });
      observer.observe(target, { childList: true, subtree: true });
      return true;
    };

    if (!startObserver() && isDocument(root)) {
      rootObserver = new MutationObserver(() => {
        if (!startObserver()) return;
        rootObserver?.disconnect();
        rootObserver = null;
        const match = findMatch();
        if (match) finish(match);
      });
      rootObserver.observe(root, { childList: true, subtree: true });
    }

    timer = setTimeout(() => finish(null), timeoutMs);

    if (signal) {
      abortHandler = () => finish(null);
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  });
}
```

- [ ] **Step 4: Verify `waitForElement` GREEN**

```bash
npm test -- tests/waitForElement.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Write `observeMatches` tests**

Create `tests/observeMatches.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

import observeMatches from "@/lib/observeMatches";

describe("observeMatches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("visits existing and newly inserted matches", async () => {
    document.body.innerHTML = '<div class="target" id="first"></div>';
    const callback = vi.fn();
    const stop = observeMatches(".target", callback);

    const second = document.createElement("div");
    second.className = "target";
    document.body.append(second);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalledWith(document.querySelector("#first"));
    expect(callback).toHaveBeenCalledWith(second);
    stop();
  });

  it("stops callbacks after cleanup", async () => {
    const callback = vi.fn();
    const stop = observeMatches(".target", callback);
    stop();

    const target = document.createElement("div");
    target.className = "target";
    document.body.append(target);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Resolve the new-module import error without implementing behavior**

Run:

```bash
npm test -- tests/observeMatches.test.js
```

Expected first result: module-resolution error. Create only this inert stub:

```js
export default function observeMatches() {
  return () => {};
}
```

Rerun the same command. Expected behavioral RED: the existing/new match test fails because callback count is zero.

- [ ] **Step 7: Implement recurring observation**

Replace the stub with:

```js
function isDocument(root) {
  return root?.nodeType === Node.DOCUMENT_NODE;
}

function getObservationTarget(root) {
  return isDocument(root) ? root.documentElement : root;
}

function visitMatches(node, selector, callback) {
  if (node?.nodeType !== Node.ELEMENT_NODE) return;
  if (node.matches(selector)) callback(node);
  node.querySelectorAll(selector).forEach(callback);
}

export default function observeMatches(
  selector,
  callback,
  { root = document, includeExisting = true } = {},
) {
  let observer = null;
  let rootObserver = null;
  let stopped = false;

  if (includeExisting) root.querySelectorAll(selector).forEach(callback);

  const startObserver = () => {
    const target = getObservationTarget(root);
    if (!target || stopped) return false;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) =>
          visitMatches(node, selector, callback),
        );
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    return true;
  };

  if (!startObserver() && isDocument(root)) {
    rootObserver = new MutationObserver(() => {
      if (!startObserver()) return;
      rootObserver?.disconnect();
      rootObserver = null;
    });
    rootObserver.observe(root, { childList: true, subtree: true });
  }

  return () => {
    stopped = true;
    observer?.disconnect();
    rootObserver?.disconnect();
  };
}
```

- [ ] **Step 8: Verify lifecycle GREEN and commit**

```bash
npm test -- tests/waitForElement.test.js tests/observeMatches.test.js
npm test
npx tsc --noEmit
npm run build
git add src/lib/waitForElement.js src/lib/observeMatches.js tests/waitForElement.test.js tests/observeMatches.test.js
git commit -m "fix: harden DOM lifecycle helpers"
```

---

### Task 4: Make global stylesheet insertion reliable at `document_start`

**Files:**
- Modify: `src/lib/addGlobalStyle.js`
- Modify: `src/scripts/loginPage.js`
- Modify: `src/scripts/flowMainUI.js`
- Modify: `src/scripts/flowDebugUI.js`
- Modify: `src/scripts/lightningPage.js`
- Modify: `src/scripts/installedPackages.js`
- Create: `tests/addGlobalStyle.test.js`

**Interfaces:**
- `addGlobalStyle(css, { id }?) => Promise<HTMLStyleElement | null>`.

- [ ] **Step 1: Write failing style tests**

Create `tests/addGlobalStyle.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import addGlobalStyle from "@/lib/addGlobalStyle";

describe("addGlobalStyle", () => {
  beforeEach(() => {
    if (!document.head) document.documentElement.prepend(document.createElement("head"));
    document.head.innerHTML = "";
  });

  it("inserts into an existing head", async () => {
    const style = await addGlobalStyle("body { color: red; }", {
      id: "test-style",
    });
    expect(style).toBe(document.querySelector("#test-style"));
  });

  it("waits for a head created after invocation", async () => {
    document.head.remove();
    const promise = addGlobalStyle("body { color: red; }", {
      id: "late-style",
    });
    const head = document.createElement("head");
    document.documentElement.prepend(head);
    const style = await promise;
    expect(style?.parentElement).toBe(head);
  });

  it("reuses a stable style id", async () => {
    const first = await addGlobalStyle("body { color: red; }", {
      id: "stable-style",
    });
    const second = await addGlobalStyle("body { color: blue; }", {
      id: "stable-style",
    });
    expect(second).toBe(first);
    expect(document.querySelectorAll("#stable-style")).toHaveLength(1);
    expect(first?.textContent).toContain("color: red");
  });
});
```

- [ ] **Step 2: Run and establish RED**

```bash
npm test -- tests/addGlobalStyle.test.js
```

Expected: document-start and stable-ID assertions fail with the current helper.

- [ ] **Step 3: Implement the bounded/idempotent helper**

Replace `src/lib/addGlobalStyle.js` with:

```js
import waitForElement from "./waitForElement";

export default async function addGlobalStyle(css, { id } = {}) {
  if (id) {
    const existing = document.getElementById(id);
    if (existing?.tagName === "STYLE") return existing;
  }

  const head = document.head ?? (await waitForElement("head"));
  if (!head) return null;

  if (id) {
    const existing = document.getElementById(id);
    if (existing?.tagName === "STYLE") return existing;
  }

  const style = document.createElement("style");
  style.type = "text/css";
  if (id) style.id = id;
  style.textContent = css;
  head.appendChild(style);
  return style;
}
```

- [ ] **Step 4: Add stable IDs mechanically without changing CSS text**

For each listed content script, keep the existing template literal byte-for-byte. Change the call prefix from:

```js
addGlobalStyle(
```

to:

```js
void addGlobalStyle(
```

Then replace only the closing call terminator after the CSS template literal with the matching block below.

`src/scripts/loginPage.js`:

```js
`, { id: "salesforce-improved-login-page" });
```

`src/scripts/flowMainUI.js`:

```js
`, { id: "salesforce-improved-flow-main" });
```

`src/scripts/flowDebugUI.js`:

```js
`, { id: "salesforce-improved-flow-debug" });
```

`src/scripts/lightningPage.js`:

```js
`, { id: "salesforce-improved-lightning-page" });
```

`src/scripts/installedPackages.js`:

```js
`, { id: "salesforce-improved-installed-packages" });
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- tests/addGlobalStyle.test.js
npm test
npx tsc --noEmit
npm run build
git add src/lib/addGlobalStyle.js src/scripts/loginPage.js src/scripts/flowMainUI.js src/scripts/flowDebugUI.js src/scripts/lightningPage.js src/scripts/installedPackages.js tests/addGlobalStyle.test.js
git commit -m "fix: make global style insertion reliable"
```

---

### Task 5: Restore popup minimization for existing and later popups

**Files:**
- Create: `src/features/popupMinimizer.js`
- Modify: `src/scripts/general.js`
- Create: `tests/popupMinimizer.test.js`

**Interfaces:**
- `minimizePopup(popup)`.
- `startPopupMinimizer({ root = document }?) => () => void`.
- `general.js` is side-effect-only startup and is not imported by unit tests.

- [ ] **Step 1: Write the desired popup tests**

Create `tests/popupMinimizer.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import {
  minimizePopup,
  startPopupMinimizer,
} from "@/features/popupMinimizer";

function popupFixture() {
  const popup = document.createElement("div");
  popup.className = "slds-docked_container forceDockingPanel DOCKED";
  popup.innerHTML = '<div class="slds-docked-composer slds-is-open"></div>';
  return popup;
}

describe("popup minimization", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("minimizes an existing open docked popup", () => {
    const popup = popupFixture();
    document.body.append(popup);
    minimizePopup(popup);
    expect(popup.classList.contains("MINIMIZED")).toBe(true);
    expect(popup.classList.contains("DOCKED")).toBe(false);
    expect(
      popup.querySelector(".slds-docked-composer")?.classList.contains("slds-is-open"),
    ).toBe(false);
  });

  it("minimizes a popup inserted after startup", async () => {
    const stop = startPopupMinimizer();
    const popup = popupFixture();
    document.body.append(popup);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(popup.classList.contains("MINIMIZED")).toBe(true);
    stop();
  });

  it("is harmless when applied repeatedly", () => {
    const popup = popupFixture();
    minimizePopup(popup);
    minimizePopup(popup);
    expect(popup.classList.contains("MINIMIZED")).toBe(true);
    expect(popup.classList.contains("DOCKED")).toBe(false);
  });
});
```

- [ ] **Step 2: Convert module-resolution failure into behavioral RED**

Run:

```bash
npm test -- tests/popupMinimizer.test.js
```

Create only this inert stub after the expected module-resolution error:

```js
export function minimizePopup() {}

export function startPopupMinimizer() {
  return () => {};
}
```

Rerun. Expected RED: class assertions fail.

- [ ] **Step 3: Implement popup behavior**

Replace the stub with:

```js
import observeMatches from "@/lib/observeMatches";

const POPUP_SELECTOR = "div.slds-docked_container.forceDockingPanel";
const POPUP_CONTENT_SELECTOR = "div.slds-docked-composer.slds-is-open";

export function minimizePopup(popup) {
  const popupContent = popup.querySelector(POPUP_CONTENT_SELECTOR);
  if (!popupContent) return;
  popup.classList.remove("DOCKED");
  popup.classList.add("MINIMIZED");
  popupContent.classList.remove("slds-is-open");
}

export function startPopupMinimizer({ root = document } = {}) {
  return observeMatches(POPUP_SELECTOR, minimizePopup, {
    root,
    includeExisting: true,
  });
}
```

Replace `src/scripts/general.js` with:

```js
import { startPopupMinimizer } from "@/features/popupMinimizer";

startPopupMinimizer();
```

- [ ] **Step 4: Verify GREEN and genuine regression coverage**

```bash
npm test -- tests/popupMinimizer.test.js tests/observeMatches.test.js
```

Expected: pass. Then temporarily remove only `popup.classList.add("MINIMIZED")`, rerun the popup test and confirm failure. Restore the line and rerun to pass. Do not commit the temporary mutation.

- [ ] **Step 5: Full verification and commit**

```bash
npm test
npm run build
git add src/features/popupMinimizer.js src/scripts/general.js tests/popupMinimizer.test.js
git commit -m "fix: restore recurring popup minimization"
```

---

### Task 6: Reapply Flow Builder sidebar sizing after delayed/replacement renders

**Files:**
- Create: `src/features/flowSidebar.js`
- Modify: `src/scripts/flowMainUI.js`
- Create: `tests/flowSidebar.test.js`

**Interfaces:**
- `increaseSidebar(sidebar)`.
- `startSidebarObserver({ root = document }?) => () => void`.

- [ ] **Step 1: Write desired Flow sidebar tests**

Create `tests/flowSidebar.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import { startSidebarObserver } from "@/features/flowSidebar";

const SIDEBAR_HTML = `
  <builder_platform_interaction-container-common>
    <div class="editor"><div class="slds-grid"><div class="slds-col">
      <builder_platform_interaction-left-panel>
        <div class="left-panel slds-size_medium"></div>
      </builder_platform_interaction-left-panel>
    </div></div></div>
  </builder_platform_interaction-container-common>`;

describe("Flow Builder sidebar", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("adjusts the final nested sidebar when it appears later", async () => {
    const stop = startSidebarObserver();
    document.body.innerHTML = SIDEBAR_HTML;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const sidebar = document.querySelector(".left-panel");
    expect(sidebar?.classList.contains("slds-size_medium")).toBe(false);
    expect(sidebar?.classList.contains("slds-size_large")).toBe(true);
    stop();
  });

  it("adjusts a replacement sidebar after rerender", async () => {
    document.body.innerHTML = SIDEBAR_HTML;
    const stop = startSidebarObserver();
    const container = document.querySelector(
      "builder_platform_interaction-container-common",
    );
    container.innerHTML = `
      <div class="editor"><div class="slds-grid"><div class="slds-col">
        <builder_platform_interaction-left-panel>
          <div id="replacement" class="left-panel slds-size_medium"></div>
        </builder_platform_interaction-left-panel>
      </div></div></div>`;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      document.querySelector("#replacement")?.classList.contains("slds-size_large"),
    ).toBe(true);
    stop();
  });
});
```

- [ ] **Step 2: Convert new-module error into behavioral RED**

After the expected module-resolution error, create only:

```js
export function increaseSidebar() {}

export function startSidebarObserver() {
  return () => {};
}
```

Run:

```bash
npm test -- tests/flowSidebar.test.js
```

Expected RED: both sizing assertions fail.

- [ ] **Step 3: Implement side-effect-free Flow behavior**

Replace the stub with:

```js
import observeMatches from "@/lib/observeMatches";

const SIDEBAR_SELECTOR = [
  "builder_platform_interaction-container-common",
  ".editor",
  "div.slds-grid",
  "div.slds-col",
  "builder_platform_interaction-left-panel",
  ".left-panel",
].join(" ");

export function increaseSidebar(sidebar) {
  sidebar.classList.remove("slds-size_medium");
  sidebar.classList.add("slds-size_large");
}

export function startSidebarObserver({ root = document } = {}) {
  return observeMatches(SIDEBAR_SELECTOR, increaseSidebar, {
    root,
    includeExisting: true,
  });
}
```

- [ ] **Step 4: Convert `flowMainUI.js` to style + startup only**

Retain the complete `void addGlobalStyle(...)` call produced in Task 4 unchanged. Remove the `waitForElement` import, old wait call, and old nested-query `increaseSidebar()` function. Add this import above the style call:

```js
import { startSidebarObserver } from "@/features/flowSidebar";
```

Add this line immediately after the style call:

```js
startSidebarObserver();
```

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/flowSidebar.test.js tests/observeMatches.test.js
npm test
npm run build
git add src/features/flowSidebar.js src/scripts/flowMainUI.js tests/flowSidebar.test.js
git commit -m "fix: reapply Flow Builder sidebar sizing after rerenders"
```

---

### Task 7: Harden Installed Packages initialization/sorting

**Files:**
- Create: `src/features/installedPackages.js`
- Modify: `src/scripts/installedPackages.js`
- Create: `tests/installedPackages.test.js`

**Interfaces:**
- `initializeInstalledPackages(table)`.
- `startInstalledPackages({ root = document, timeoutMs = 10000 }?) => Promise<Element | null>`.
- Table marker: `data-salesforce-improved-initialized="true"`.

- [ ] **Step 1: Write desired tests**

Create `tests/installedPackages.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  initializeInstalledPackages,
  startInstalledPackages,
} from "@/features/installedPackages";

function tableFixture() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <table class="list">
      <thead><tr class="headerRow"><th>Name</th><th>Status</th><th>Publisher</th></tr></thead>
      <tbody>
        <tr class="dataRow"><th scope="row">Pkg B</th><td>Installed</td><td>Zulu</td></tr>
        <tr class="dataRow last"><th scope="row">Pkg A</th><td>Installed</td><td>Alpha</td></tr>
      </tbody>
    </table>`;
  return wrapper.querySelector("table");
}

describe("Installed Packages", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null when the table never appears", async () => {
    vi.useFakeTimers();
    const promise = startInstalledPackages({ timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    await expect(promise).resolves.toBeNull();
  });

  it("initializes a table that appears asynchronously", async () => {
    const promise = startInstalledPackages({ timeoutMs: 100 });
    const table = tableFixture();
    document.body.append(table);
    await expect(promise).resolves.toBe(table);
    expect(table.dataset.salesforceImprovedInitialized).toBe("true");
  });

  it("sorts by column index 2 by default", () => {
    const table = tableFixture();
    document.body.append(table);
    initializeInstalledPackages(table);
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows[0].children[2].textContent).toBe("Alpha");
    expect(rows[1].children[2].textContent).toBe("Zulu");
  });

  it("does not nest header anchors when initialized twice", () => {
    const table = tableFixture();
    document.body.append(table);
    initializeInstalledPackages(table);
    initializeInstalledPackages(table);
    expect(table.querySelectorAll("tr.headerRow th a a")).toHaveLength(0);
    expect(
      table.querySelectorAll(
        "tr.headerRow th > a[data-salesforce-improved-sort-link]",
      ),
    ).toHaveLength(3);
  });

  it("attaches one click listener per table", () => {
    const table = tableFixture();
    document.body.append(table);
    const headerRow = table.querySelector("tr.headerRow");
    const addListener = vi.spyOn(EventTarget.prototype, "addEventListener");
    initializeInstalledPackages(table);
    initializeInstalledPackages(table);
    const registrations = addListener.mock.calls.filter(
      (call, index) =>
        addListener.mock.instances[index] === headerRow && call[0] === "click",
    );
    expect(registrations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Convert new-module error into behavioral RED**

After the expected module-resolution error, create only:

```js
export function initializeInstalledPackages(table) {
  return table;
}

export async function startInstalledPackages() {
  return null;
}
```

Run:

```bash
npm test -- tests/installedPackages.test.js
```

Expected RED: async initialization, sorting, markers, and sortable-link assertions fail.

- [ ] **Step 3: Implement table-rooted transformations**

Replace the stub with a module beginning:

```js
import waitForElement from "@/lib/waitForElement";

function replaceTableHeaderWithTableData(table) {
  table.querySelectorAll("tr.dataRow").forEach((row) => {
    const thElement = row.querySelector("th[scope='row']");
    if (!thElement) return;
    const newElement = document.createElement("td");
    newElement.classList.add("dataCell");
    thElement.childNodes.forEach((child) => {
      newElement.appendChild(child.cloneNode(true));
    });
    row.replaceChild(newElement, thElement);
  });
}

function replaceRowDividers(table) {
  table.querySelectorAll("tbody tr.dataRow").forEach((row) => {
    if (row.classList.contains("last")) {
      row.classList.remove("last");
      row.classList.add("first");
    }
  });
}

function addSortableClass(table) {
  table.classList.add("sortable");
}
```

Add idempotent header setup:

```js
function makeSortable(table) {
  const headerRow = table.querySelector("tr.headerRow");
  if (!headerRow) return;

  headerRow.querySelectorAll("th").forEach((header) => {
    let link = header.querySelector(":scope > a");
    if (!link) {
      link = document.createElement("a");
      link.href = "#";
      while (header.firstChild) link.appendChild(header.firstChild);
      header.appendChild(link);
    }
    link.dataset.salesforceImprovedSortLink = "true";
  });

  headerRow.addEventListener("click", sortTableFunction(table));
}

function sortTableFunction(table) {
  return (event) => {
    if (event.target?.nodeType !== Node.ELEMENT_NODE) return;
    const link = event.target.closest(
      "a[data-salesforce-improved-sort-link]",
    );
    const header = link?.parentElement;
    if (!link || !header) return;
    sortRows(table, siblingIndex(header));
    event.preventDefault();
  };
}
```

Add fail-open sorting:

```js
function sortRows(table, columnIndex) {
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  const selector = `td:nth-child(${columnIndex + 1})`;
  const values = [];
  table.querySelectorAll("tbody tr").forEach((row) => {
    const node = row.querySelector(selector);
    if (node) values.push({ value: node.textContent ?? "", row });
  });
  values.sort((a, b) => a.value.localeCompare(b.value));
  values.forEach(({ row }) => tbody.appendChild(row));
}

function siblingIndex(node) {
  let count = 0;
  while ((node = node.previousElementSibling)) count += 1;
  return count;
}
```

Finish with:

```js
export function initializeInstalledPackages(table) {
  if (table.dataset.salesforceImprovedInitialized === "true") return table;
  replaceRowDividers(table);
  replaceTableHeaderWithTableData(table);
  addSortableClass(table);
  makeSortable(table);
  sortRows(table, 2);
  table.dataset.salesforceImprovedInitialized = "true";
  return table;
}

export async function startInstalledPackages({
  root = document,
  timeoutMs = 10_000,
} = {}) {
  const table = await waitForElement("table.list", { root, timeoutMs });
  if (!table) return null;
  return initializeInstalledPackages(table);
}
```

- [ ] **Step 4: Convert the entrypoint to CSS + startup only**

Retain the complete `void addGlobalStyle(...)` call from Task 4 unchanged. Remove all table manipulation/sorting functions from `src/scripts/installedPackages.js`. Add:

```js
import { startInstalledPackages } from "@/features/installedPackages";
```

Then after the style call add:

```js
void startInstalledPackages();
```

- [ ] **Step 5: Verify GREEN and the null-table regression**

```bash
npm test -- tests/installedPackages.test.js
```

Expected: pass. Temporarily delete only `if (!table) return null;`, rerun the test, and confirm the missing-table case fails. Restore the guard and rerun to pass. Do not commit the temporary mutation.

- [ ] **Step 6: Full verification and commit**

```bash
npm test
npm run build
git add src/features/installedPackages.js src/scripts/installedPackages.js tests/installedPackages.test.js
git commit -m "fix: harden Installed Packages DOM handling"
```

---

### Task 8: Preserve login manager identity/listeners and guard missing containers

**Files:**
- Create: `src/features/loginPage.js`
- Modify: `src/scripts/loginPage.js`
- Create: `tests/loginPage.test.js`

**Interfaces:**
- `moveLoginsToRight()`.
- `moveSavedLoginsEditorToRight()`.
- `sortSavedUsernames()`.
- Entrypoint retains style + bounded wait orchestration only.

- [ ] **Step 1: Write desired login behavior tests**

Create `tests/loginPage.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  moveSavedLoginsEditorToRight,
  sortSavedUsernames,
} from "@/features/loginPage";

describe("login page behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the original manager and preserves listeners", () => {
    document.body.innerHTML = `
      <div id="left"><div id="manager"><button id="edit">Edit</button></div></div>
      <div id="right"><div id="content"></div></div>`;
    const manager = document.querySelector("#manager");
    const edit = document.querySelector("#edit");
    const listener = vi.fn();
    edit.addEventListener("click", listener);
    moveSavedLoginsEditorToRight();
    expect(document.querySelector("#manager")).toBe(manager);
    expect(manager.parentElement).toBe(document.querySelector("#right #content"));
    edit.click();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not throw when the no-login parent is absent", () => {
    document.body.innerHTML = '<div id="idlist"><div>placeholder</div></div>';
    expect(() => sortSavedUsernames()).not.toThrow();
  });
});
```

- [ ] **Step 2: Convert new-module error into behavioral RED**

After the expected module-resolution error, create only:

```js
export function moveLoginsToRight() {}
export function moveSavedLoginsEditorToRight() {}
export function sortSavedUsernames() {}
```

Run:

```bash
npm test -- tests/loginPage.test.js
```

Expected RED: manager parent assertion fails.

- [ ] **Step 3: Move the existing DOM logic into the feature module**

Move the current `moveLoginsToRight()` implementation from `src/scripts/loginPage.js` into `src/features/loginPage.js` unchanged and export it.

Implement:

```js
export function moveSavedLoginsEditorToRight() {
  const savedLoginEditor = document.getElementById("manager");
  const rightContainer = document.querySelector("#right #content");
  if (savedLoginEditor && rightContainer) rightContainer.appendChild(savedLoginEditor);
}
```

Move the current `sortSavedUsernames()` logic into the feature module and export it. Preserve its alphabetical sort. In its `sortedLogins.length <= 1` branch, use:

```js
const parentContainer = document.querySelector("div#right #content");
if (!parentContainer) return;
parentContainer.innerHTML = `
  <div>
    <h2 style="text-align: center">Salesforce Improved</h2>
    <p style="text-align: center; margin-bottom: 0.83em">No saved logins to display.</p>
  </div>
`;
return;
```

- [ ] **Step 4: Reduce login entrypoint to style + bounded orchestration**

Retain Task 4's complete style call unchanged. Import:

```js
import {
  moveLoginsToRight,
  moveSavedLoginsEditorToRight,
  sortSavedUsernames,
} from "@/features/loginPage";
import waitForElement from "../lib/waitForElement";
```

After the style call, use:

```js
void waitForElement("#main").then((main) => {
  if (!main) return;
  moveLoginsToRight();
  moveSavedLoginsEditorToRight();
});

void waitForElement("#idlist").then((idlist) => {
  if (!idlist) return;
  setTimeout(sortSavedUsernames, 500);
});
```

Retain the existing 500 ms delay.

- [ ] **Step 5: Verify GREEN and listener regression**

```bash
npm test -- tests/loginPage.test.js
```

Expected: pass. Temporarily restore the old clone/remove behavior inside `moveSavedLoginsEditorToRight`, rerun, and confirm the identity/listener test fails. Restore the move implementation and rerun to pass. Do not commit the temporary mutation.

- [ ] **Step 6: Full verification and commit**

```bash
npm test
npm run build
git add src/features/loginPage.js src/scripts/loginPage.js tests/loginPage.test.js
git commit -m "fix: preserve saved-login editor behavior"
```

---

### Task 9: Fix popup UI and development documentation defects

**Files:**
- Modify: `src/App.tsx`
- Modify: `README.md`
- Modify: `components.json`

**Interfaces:**
- Preserves popup layout and Settings behavior.
- Adds valid icon sizing/alt and normal-tab GitHub navigation.

The approved spec explicitly permits static lint/type verification for these small markup changes instead of adding a component test.

- [ ] **Step 1: Correct popup markup**

Replace the icon with:

```tsx
<img
  src={icon}
  className="h-12 w-12"
  alt="Salesforce Improved extension icon"
/>
```

Replace the GitHub anchor opening tag with:

```tsx
<a
  href="https://github.com/mselchow/salesforce-improved-extension"
  target="_blank"
  rel="noreferrer"
  className="underline"
>
```

Keep the Settings button logic unchanged.

- [ ] **Step 2: Correct README load instructions**

Document `dist` as the CRXJS-generated unpacked extension directory for local build/development output; remove the instruction to load `src` after `npm run dev`.

Add this note after the Load Unpacked instructions:

```markdown
After installing or updating the extension, refresh any Salesforce tabs that were already open so Chrome loads the new static content scripts on those pages.
```

- [ ] **Step 3: Correct Phase 1 shadcn stylesheet path**

Change `components.json` from:

```json
"css": "src/globals.css"
```

to:

```json
"css": "src/styles/globals.css"
```

Phase 2 deletes `components.json` after pruning shadcn infrastructure.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
npm run build
git add src/App.tsx README.md components.json
git commit -m "fix: clean up popup and development docs"
```

If lint fails only because pre-existing TSX files are outside the current lint script, leave that to Task 10; do not weaken any rules.

---

### Task 10: Add complete local/CI quality gates and generated-manifest verification

**Files:**
- Modify: `package.json`
- Create: `scripts/verify-manifest.mjs`
- Create: `.github/workflows/check.yml`
- Modify: files changed by project-wide Prettier formatting.
- Modify: `.eslintrc.json` only if a legitimate parser/resolver adjustment is required.

**Interfaces:**
- Produces: `test`, `typecheck`, `lint`, `format:check`, `verify:manifest`, `check` scripts.
- `npm run check` is the Phase 1 pre-merge gate.

- [ ] **Step 1: Add generated-manifest verification**

Create `scripts/verify-manifest.mjs`:

```js
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"),
);

const requiredMatches = [
  "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
  "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
  "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
];

const failures = [];
if (manifest.background) failures.push("background service worker remains");
if ((manifest.permissions ?? []).includes("scripting")) {
  failures.push("scripting permission remains");
}
if (manifest.host_permissions) failures.push("host_permissions remains");

const installed = manifest.content_scripts?.find((script) =>
  script.matches?.includes(requiredMatches[0]),
);
if (!installed) {
  failures.push("modern Installed Packages content script route is missing");
} else {
  for (const match of requiredMatches) {
    if (!installed.matches?.includes(match)) failures.push(`missing match: ${match}`);
  }
  if (installed.all_frames !== true) failures.push("Installed Packages all_frames is not true");
}

if (failures.length) {
  throw new Error(`Generated manifest verification failed:\n- ${failures.join("\n- ")}`);
}
console.log("Generated manifest verification passed.");
```

- [ ] **Step 2: Expand package scripts**

Set the scripts to include:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit",
"lint": "eslint --ext .js,.ts,.tsx .",
"format": "prettier --write .",
"format:check": "prettier --check .",
"verify:manifest": "node scripts/verify-manifest.mjs",
"check": "npm run test && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run verify:manifest"
```

Retain `dev`, `build`, and `preview`.

- [ ] **Step 3: Run broadened lint and fix actual errors**

```bash
npm run lint
```

Fix each reported error under existing rules. Do not add blanket disables or remove `.tsx` coverage.

- [ ] **Step 4: Establish a clean Prettier gate**

```bash
npm run format:check
```

Expected initially: may fail on the files Codex identified. Run the repository's existing formatter:

```bash
npm run format
```

Then inspect:

```bash
git diff --stat
git diff --word-diff=plain
```

Confirm changes outside Tasks 1–9 are formatting-only. If formatting touches unrelated files, commit those formatting-only changes separately before the gate commit.

- [ ] **Step 5: Add CI**

Create `.github/workflows/check.yml`:

```yaml
name: Check

on:
  push:
    branches:
      - main
      - staging
  pull_request:
    branches:
      - main
      - staging

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run project gate
        run: npm run check
```

If the legacy Phase 1 toolchain fails solely because a dependency's published engine does not support Node 22, use Node 20 temporarily and add exactly:

```yaml
# Temporary Phase 1 runtime; Phase 2 must revalidate and move CI to Node 22.
```

above `node-version: 20`.

- [ ] **Step 6: Run the entire local gate fresh**

```bash
npm run check
```

Expected: tests, typecheck, JS/TS/TSX lint, Prettier, build, and generated manifest verification all exit 0.

- [ ] **Step 7: Commit formatting separately if needed**

If Task 4 produced unrelated formatting-only changes:

```bash
git add -A
git commit -m "style: apply project formatting"
```

Before committing, inspect `git status --short` and ensure every staged path is formatting-only.

- [ ] **Step 8: Commit the gate**

```bash
git add package.json package-lock.json scripts/verify-manifest.mjs .github/workflows/check.yml
git add .eslintrc.json 2>/dev/null || true
git commit -m "chore: enforce project quality gates"
```

---

### Task 11: Final Phase 1 verification and handoff

**Files:**
- No production changes expected.

**Interfaces:**
- Produces: evidence for review/PR; explicitly stops before Phase 2.

- [ ] **Step 1: Verify approved-spec coverage**

Re-read `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md` and confirm:

- background injector absent;
- scripting permission absent;
- modern Setup-domain Installed Packages route present;
- existing/new popup behavior tested;
- missing/async Installed Packages table tested;
- Flow delayed/replacement render tested;
- login manager identity/listener preservation tested;
- document-start style insertion tested;
- JS/TS/TSX lint gate present;
- README/config/popup cleanup complete.

- [ ] **Step 2: Verify from lockfile with fresh output**

```bash
npm ci
npm run check
```

Expected: both exit 0.

- [ ] **Step 3: Review scope**

```bash
git diff --stat fix/staging-review-remediation...HEAD
git diff fix/staging-review-remediation...HEAD
```

No broad dependency/toolchain upgrade should exist beyond Vitest 0.34.6/jsdom 22.1.0 added for Phase 1 tests.

- [ ] **Step 4: Perform authenticated browser smoke testing only if access exists**

Load `dist` in Chrome and check ordinary Lightning, Setup home, App Builder, Flow Builder, Flow Debug, Installed Packages, and Salesforce login/saved-login. During extension reload/update, leave representative tabs open, confirm no service-worker injection error exists, refresh the tabs, and verify applicable adjustments occur once.

If authenticated Salesforce access is unavailable, report this checklist as **not executed**.

- [ ] **Step 5: Stop before modernization**

Do not execute `docs/superpowers/plans/2026-09-10-staging-review-toolchain-modernization.md` until this Phase 1 result is reviewed and accepted as the behavioral baseline.
