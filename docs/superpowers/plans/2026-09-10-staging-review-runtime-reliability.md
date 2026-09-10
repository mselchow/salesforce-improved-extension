# Staging Review Runtime Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development for production-code changes and superpowers:verification-before-completion before every commit or completion claim.

**Goal:** Fix the confirmed browser/content-script defects from the staging review, add modern Salesforce Setup routing, and establish deterministic automated project gates without changing unrelated product behavior.

**Architecture:** Remove the install/update programmatic injector and rely exclusively on static content scripts. Introduce one bounded DOM-wait helper and one recurring DOM-observer helper, then make each affected content script consume the appropriate lifecycle primitive with idempotent operations. Add Vitest/jsdom regression coverage, generated-manifest verification, and CI before any dependency/toolchain modernization.

**Tech Stack:** Chrome Manifest V3, CRXJS/Vite, JavaScript content scripts, React/TypeScript popup/options UI, Vitest 0.34.6, jsdom 22.1.0, ESLint, Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- GitHub `staging` at `ec8a76aa3c5d2e7414f1b6ae8afbe8b8bb9c544d` is the authoritative product source; do not reconstruct Codex-only uncommitted edits.
- Do not preserve seamless programmatic reinjection into already-open Salesforce tabs; users may refresh tabs after install/update.
- Content scripts must fail open when expected Salesforce DOM is absent.
- Intentional repeated SPA behavior must be idempotent.
- Do not add Playwright/Puppeteer in Phase 1.
- Do not begin dependency/toolchain modernization until this plan's full `npm run check` gate passes.
- Do not claim authenticated Salesforce smoke testing was completed unless it was actually performed.
- Keep Phase 1 changes on a branch based on `fix/staging-review-remediation` or on a fresh branch based on its latest commit; do not implement directly on `staging`.

---

## File Structure

### Files created

- `vitest.config.ts` — Vitest/jsdom configuration and `@` alias used by unit/DOM tests.
- `src/lib/observeMatches.js` — recurring MutationObserver helper for Salesforce SPA rerenders.
- `tests/domLifecycle.test.js` — `waitForElement` and `observeMatches` lifecycle tests.
- `tests/addGlobalStyle.test.js` — document-start-safe style insertion tests.
- `tests/general.test.js` — docked-popup minimization tests.
- `tests/flowMainUI.test.js` — Flow Builder sidebar delayed/replacement render tests.
- `tests/installedPackages.test.js` — Installed Packages initialization/sorting/idempotency tests.
- `tests/loginPage.test.js` — login-page node-movement and null-guard tests.
- `tests/manifest.test.ts` — source-manifest behavior tests.
- `scripts/verify-manifest.mjs` — post-build generated-manifest invariant verifier.
- `.github/workflows/check.yml` — CI quality gate for `staging`/`main` pushes and PRs.

### Files modified

- `package.json` / `package-lock.json` — test dependencies and quality scripts.
- `manifest.ts` — testable manifest factory, remove background/scripting/host permissions, add current Installed Packages routes.
- `src/lib/waitForElement.js` — bounded wait with timeout and abort cleanup.
- `src/lib/addGlobalStyle.js` — asynchronous, bounded, idempotent style insertion.
- `src/scripts/general.js` — recurring popup minimization.
- `src/scripts/flowMainUI.js` — observe the final sidebar selector and reapply after rerender.
- `src/scripts/installedPackages.js` — asynchronous table initialization, table-rooted helpers, null guards, idempotent sorting UI.
- `src/scripts/loginPage.js` — move original `#manager`, null-guard no-login content, stable style ID.
- `src/scripts/flowDebugUI.js` — stable style ID.
- `src/scripts/lightningPage.js` — stable style ID.
- `src/App.tsx` — valid icon sizing, alt text, normal-tab GitHub link.
- `README.md` — correct `dist` loading instructions and refresh-after-update note.
- `components.json` — correct stylesheet path for Phase 1; Phase 2 may delete this file.
- `.eslintrc.json` only if Phase 1 linting exposes a necessary configuration correction; do not perform the Phase 2 ESLint-major migration here.

### File deleted

- `src/scripts/background.js` — obsolete install/update injector.

---

### Task 1: Establish the DOM regression harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/harness.test.js`

**Interfaces:**
- Produces: `npm test` running Vitest in jsdom; test files can import aliases from `@/`.
- Consumes: existing Vite/TypeScript module setup.

- [ ] **Step 1: Create a failing jsdom smoke test**

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

- [ ] **Step 2: Verify the test command does not exist yet**

Run:

```bash
npm test
```

Expected: npm reports that there is no `test` script (or equivalent failure proving the harness is not configured).

- [ ] **Step 3: Install a Vitest/jsdom pair compatible with the existing Vite 4 toolchain**

Run:

```bash
npm install --save-dev vitest@0.34.6 jsdom@22.1.0
```

Do not upgrade Vite, CRXJS, TypeScript, ESLint, React, or other existing packages in this task.

- [ ] **Step 4: Add Vitest configuration**

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

Add this script to `package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Run the smoke test**

Run:

```bash
npm test -- tests/harness.test.js
```

Expected: 1 test passes.

- [ ] **Step 6: Verify the existing build still succeeds**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 7: Commit the harness**

```bash
git add package.json package-lock.json vitest.config.ts tests/harness.test.js
git commit -m "test: add DOM regression harness"
```

---

### Task 2: Remove install-time reinjection and make the manifest testable/current

**Files:**
- Modify: `manifest.ts`
- Delete: `src/scripts/background.js`
- Create: `tests/manifest.test.ts`

**Interfaces:**
- Produces: `buildManifest(env: { mode: string })`, a plain manifest factory usable by tests and wrapped by CRXJS `defineManifest` for production.
- Produces: Installed Packages matches containing modern Setup-domain, transitional Lightning-domain, and legacy Classic routes.
- Removes: `background`, `permissions: ["scripting"]`, and `host_permissions` from the manifest.

- [ ] **Step 1: Write source-manifest regression tests first**

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
  it("does not use install-time programmatic script injection", () => {
    const manifest = buildManifest({ mode: "test" });

    expect(manifest.background).toBeUndefined();
    expect(manifest.permissions ?? []).not.toContain("scripting");
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("matches Installed Packages on current and transitional Salesforce routes", () => {
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

- [ ] **Step 2: Run the manifest tests and verify they fail**

Run:

```bash
npm test -- tests/manifest.test.ts
```

Expected: FAIL because `buildManifest` does not exist and/or the current manifest still contains background/scripting and lacks the modern routes.

- [ ] **Step 3: Refactor `manifest.ts` into a plain factory plus CRXJS wrapper**

Keep the existing SemVer-to-Chrome version extraction. Replace the current inline `defineManifest(async (env) => ({ ... }))` structure with this shape:

```ts
import { defineManifest } from "@crxjs/vite-plugin";

import { version } from "./package.json";

const [major, minor, patch] = version
  .replace(/[^\d.-]+/g, "")
  .split(/[.-]/);

interface ManifestEnvironment {
  mode: string;
}

export function buildManifest(env: ManifestEnvironment) {
  return {
    manifest_version: 3 as const,
    name:
      env.mode === "development"
        ? "[DEV] Salesforce Improved"
        : "Salesforce Improved",
    version: `${major}.${minor}.${patch}`,
    version_name: version,
    description:
      "This extension improves the Salesforce UI by adjusting the layout of some pages to make them more user friendly.",
    icons: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
    action: { default_popup: "index.html" },
    options_page: "src/options/index.html",
    content_scripts: [
      {
        js: ["src/scripts/loginPage.js"],
        matches: [
          "*://*.my.salesforce.com/*",
          "*://login.salesforce.com/*",
          "*://test.salesforce.com/*",
        ],
        run_at: "document_idle" as const,
      },
      {
        js: ["src/scripts/general.js"],
        matches: ["*://*.force.com/lightning*"],
        run_at: "document_idle" as const,
      },
      {
        js: ["src/scripts/lightningPage.js"],
        matches: ["*://*.force.com/visualEditor/appBuilder.app*"],
        run_at: "document_idle" as const,
      },
      {
        js: ["src/scripts/flowMainUI.js"],
        matches: [
          "*://*.force.com/builder_platform_interaction/flowBuilder.app*",
        ],
        run_at: "document_idle" as const,
      },
      {
        js: ["src/scripts/flowDebugUI.js"],
        matches: ["*://*.vf.force.com/flow/*"],
        run_at: "document_start" as const,
      },
      {
        js: ["src/scripts/installedPackages.js"],
        matches: [
          "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
          "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
          "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
        ],
        run_at: "document_idle" as const,
        all_frames: true,
      },
    ],
  };
}

export const manifest = defineManifest((env) => buildManifest(env));
```

If TypeScript reports that the CRXJS environment has a richer type than `ManifestEnvironment`, keep the structural `{ mode: string }` interface and let the richer value flow into it; do not weaken this to `any` unless CRXJS typing makes structural inference impossible.

- [ ] **Step 4: Delete the obsolete background injector**

```bash
git rm src/scripts/background.js
```

Do not replace it with another service worker.

- [ ] **Step 5: Run the manifest tests**

```bash
npm test -- tests/manifest.test.ts
```

Expected: both tests pass.

- [ ] **Step 6: Type-check and build the refactored manifest**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Inspect the built `dist/manifest.json` manually before committing**

Run:

```bash
node -e 'const m=require("./dist/manifest.json"); console.log(JSON.stringify({background:m.background,permissions:m.permissions,host_permissions:m.host_permissions,content_scripts:m.content_scripts},null,2))'
```

Expected:

- no `background` entry;
- no `scripting` permission;
- no `host_permissions` entry;
- Installed Packages content script includes the three intended route patterns.

- [ ] **Step 8: Commit the manifest fix**

```bash
git add manifest.ts tests/manifest.test.ts
git commit -m "fix: remove install-time content script injection"
```

---

### Task 3: Replace the unbounded DOM wait and add a recurring observer primitive

**Files:**
- Modify: `src/lib/waitForElement.js`
- Create: `src/lib/observeMatches.js`
- Create: `tests/domLifecycle.test.js`

**Interfaces:**
- Produces: `waitForElement(selector, options?) => Promise<Element | null>` with `{ root = document, timeoutMs = 10000, signal }`.
- Produces: `observeMatches(selector, callback, options?) => () => void` with `{ root = document, includeExisting = true }`.

- [ ] **Step 1: Write the lifecycle tests**

Create `tests/domLifecycle.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeMatches from "@/lib/observeMatches";
import waitForElement from "@/lib/waitForElement";

describe("DOM lifecycle helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves an existing element immediately", async () => {
    document.body.innerHTML = '<div class="target"></div>';

    await expect(waitForElement(".target")).resolves.toBe(
      document.querySelector(".target"),
    );
  });

  it("resolves when an element is inserted later", async () => {
    const promise = waitForElement(".target", { timeoutMs: 100 });
    const target = document.createElement("div");
    target.className = "target";
    document.body.append(target);

    await expect(promise).resolves.toBe(target);
  });

  it("returns null on timeout and disconnects", async () => {
    vi.useFakeTimers();
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");

    const promise = waitForElement(".missing", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it("returns null on abort and disconnects", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const controller = new AbortController();
    const promise = waitForElement(".missing", {
      timeoutMs: 1000,
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it("observes existing and newly inserted matches", async () => {
    document.body.innerHTML = '<div class="target" id="first"></div>';
    const callback = vi.fn();
    const stop = observeMatches(".target", callback);

    const second = document.createElement("div");
    second.className = "target";
    second.id = "second";
    document.body.append(second);
    await Promise.resolve();

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
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npm test -- tests/domLifecycle.test.js
```

Expected: FAIL because `observeMatches.js` does not exist and current `waitForElement` has no timeout/abort contract.

- [ ] **Step 3: Implement bounded `waitForElement`**

Replace `src/lib/waitForElement.js` with:

```js
const DEFAULT_TIMEOUT_MS = 10_000;

function getObservationTarget(root) {
  return root instanceof Document ? root.documentElement : root;
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
      if (abortHandler && signal) {
        signal.removeEventListener("abort", abortHandler);
      }
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

    if (!startObserver() && root instanceof Document) {
      rootObserver = new MutationObserver(() => {
        if (startObserver()) {
          rootObserver?.disconnect();
          rootObserver = null;
        }
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

If Vitest/jsdom exposes `Document` differently in the test runtime, use `root.nodeType === Node.DOCUMENT_NODE` instead of `instanceof Document`; keep the same behavior and tests.

- [ ] **Step 4: Implement recurring `observeMatches`**

Create `src/lib/observeMatches.js`:

```js
function getObservationTarget(root) {
  return root instanceof Document ? root.documentElement : root;
}

function visitMatches(node, selector, callback) {
  if (!(node instanceof Element)) return;

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

  if (includeExisting) {
    root.querySelectorAll(selector).forEach(callback);
  }

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

  if (!startObserver() && root instanceof Document) {
    rootObserver = new MutationObserver(() => {
      if (startObserver()) {
        rootObserver?.disconnect();
        rootObserver = null;
      }
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

- [ ] **Step 5: Run lifecycle tests**

```bash
npm test -- tests/domLifecycle.test.js
```

Expected: all lifecycle tests pass.

- [ ] **Step 6: Run existing test suite and type/build checks**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the lifecycle primitives**

```bash
git add src/lib/waitForElement.js src/lib/observeMatches.js tests/domLifecycle.test.js
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
- Consumes: `waitForElement(selector, options?)` from Task 3.
- Produces: `addGlobalStyle(css, { id }?) => Promise<HTMLStyleElement | null>`.

- [ ] **Step 1: Write style-helper tests**

Create `tests/addGlobalStyle.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import addGlobalStyle from "@/lib/addGlobalStyle";

describe("addGlobalStyle", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("inserts into an existing head", async () => {
    const style = await addGlobalStyle("body { color: red; }", {
      id: "test-style",
    });

    expect(style).toBe(document.querySelector("#test-style"));
    expect(style?.textContent).toContain("color: red");
  });

  it("waits for head when invoked before head exists", async () => {
    document.head.remove();
    const promise = addGlobalStyle("body { color: red; }", {
      id: "late-style",
    });

    const head = document.createElement("head");
    document.documentElement.prepend(head);

    const style = await promise;
    expect(style?.parentElement).toBe(head);
  });

  it("reuses a style with the same stable id", async () => {
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

- [ ] **Step 2: Run tests and verify the document-start case fails**

```bash
npm test -- tests/addGlobalStyle.test.js
```

Expected: FAIL because the current helper returns immediately when `<head>` is absent and has no ID/idempotency support.

- [ ] **Step 3: Implement asynchronous, idempotent style insertion**

Replace `src/lib/addGlobalStyle.js` with:

```js
import waitForElement from "./waitForElement";

export default async function addGlobalStyle(css, { id } = {}) {
  if (id) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLStyleElement) return existing;
  }

  const head = document.head ?? (await waitForElement("head"));
  if (!head) return null;

  if (id) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLStyleElement) return existing;
  }

  const style = document.createElement("style");
  style.type = "text/css";
  if (id) style.id = id;
  style.textContent = css;
  head.appendChild(style);
  return style;
}
```

- [ ] **Step 4: Give every retained style block a stable ID**

Keep each script's CSS text unchanged; change only the helper call shape:

```js
void addGlobalStyle(`...existing css...`, {
  id: "salesforce-improved-login-page",
});
```

Use these exact IDs:

- `loginPage.js`: `salesforce-improved-login-page`
- `flowMainUI.js`: `salesforce-improved-flow-main`
- `flowDebugUI.js`: `salesforce-improved-flow-debug`
- `lightningPage.js`: `salesforce-improved-lightning-page`
- `installedPackages.js`: `salesforce-improved-installed-packages`

Do not change CSS selectors/rules in this task.

- [ ] **Step 5: Run style tests and full existing checks**

```bash
npm test -- tests/addGlobalStyle.test.js
npm test
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit style reliability**

```bash
git add src/lib/addGlobalStyle.js src/scripts/loginPage.js src/scripts/flowMainUI.js src/scripts/flowDebugUI.js src/scripts/lightningPage.js src/scripts/installedPackages.js tests/addGlobalStyle.test.js
git commit -m "fix: make global style insertion reliable"
```

---

### Task 5: Restore popup minimization for existing and later popups

**Files:**
- Modify: `src/scripts/general.js`
- Create: `tests/general.test.js`

**Interfaces:**
- Consumes: `observeMatches(selector, callback, options?)` from Task 3.
- Produces: exported `minimizePopup(popup)` and `startPopupMinimizer()` for deterministic testing.

- [ ] **Step 1: Write popup behavior tests**

Create `tests/general.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import {
  minimizePopup,
  startPopupMinimizer,
} from "@/scripts/general";

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
    expect(popup.querySelector(".slds-docked-composer")?.classList.contains("slds-is-open")).toBe(false);
  });

  it("minimizes a popup inserted after startup", async () => {
    const stop = startPopupMinimizer();
    const popup = popupFixture();
    document.body.append(popup);
    await Promise.resolve();

    expect(popup.classList.contains("MINIMIZED")).toBe(true);
    stop();
  });

  it("is harmless when applied repeatedly", () => {
    const popup = popupFixture();
    document.body.append(popup);

    minimizePopup(popup);
    minimizePopup(popup);

    expect(popup.classList.contains("MINIMIZED")).toBe(true);
    expect(popup.classList.contains("DOCKED")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

```bash
npm test -- tests/general.test.js
```

Expected: FAIL because current `general.js` exports no testable functions and the callback passed to `waitForElement` never executes.

- [ ] **Step 3: Replace the broken one-time wait with recurring observation**

Refactor `src/scripts/general.js` to this behavior:

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

export function startPopupMinimizer() {
  return observeMatches(POPUP_SELECTOR, minimizePopup, {
    includeExisting: true,
  });
}

startPopupMinimizer();
```

Do not add global polling or an interval.

- [ ] **Step 4: Run popup and lifecycle tests**

```bash
npm test -- tests/general.test.js tests/domLifecycle.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Run the full suite/build**

```bash
npm test
npm run build
```

Expected: exit code 0.

- [ ] **Step 6: Commit popup behavior**

```bash
git add src/scripts/general.js tests/general.test.js
git commit -m "fix: restore recurring popup minimization"
```

---

### Task 6: Make the Flow Builder sidebar survive delayed and replacement renders

**Files:**
- Modify: `src/scripts/flowMainUI.js`
- Create: `tests/flowMainUI.test.js`

**Interfaces:**
- Consumes: `observeMatches` from Task 3 and `addGlobalStyle` from Task 4.
- Produces: exported `increaseSidebar(sidebar)` and `startSidebarObserver()`.

- [ ] **Step 1: Write delayed/replacement sidebar tests**

Create `tests/flowMainUI.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import { startSidebarObserver } from "@/scripts/flowMainUI";

const SIDEBAR_HTML = `
  <builder_platform_interaction-container-common>
    <div class="editor">
      <div class="slds-grid">
        <div class="slds-col">
          <builder_platform_interaction-left-panel>
            <div class="left-panel slds-size_medium"></div>
          </builder_platform_interaction-left-panel>
        </div>
      </div>
    </div>
  </builder_platform_interaction-container-common>
`;

describe("Flow Builder sidebar", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("adjusts the final nested sidebar when it appears later", async () => {
    const stop = startSidebarObserver();
    document.body.innerHTML = SIDEBAR_HTML;
    await Promise.resolve();

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
    await Promise.resolve();

    expect(document.querySelector("#replacement")?.classList.contains("slds-size_large")).toBe(true);
    stop();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/flowMainUI.test.js
```

Expected: FAIL because current code waits for an outer component only once and does not export/start a recurring final-target observer.

- [ ] **Step 3: Refactor Flow Builder behavior around the final selector**

Keep the existing CSS and stable style ID from Task 4. Define:

```js
import addGlobalStyle from "../lib/addGlobalStyle";
import observeMatches from "../lib/observeMatches";

const SIDEBAR_SELECTOR = [
  "builder_platform_interaction-container-common",
  ".editor",
  "div.slds-grid",
  "div.slds-col",
  "builder_platform_interaction-left-panel",
  ".left-panel",
].join(" ");

// existing addGlobalStyle(...) call remains here

export function increaseSidebar(sidebar) {
  sidebar.classList.remove("slds-size_medium");
  sidebar.classList.add("slds-size_large");
}

export function startSidebarObserver() {
  return observeMatches(SIDEBAR_SELECTOR, increaseSidebar, {
    includeExisting: true,
  });
}

startSidebarObserver();
```

Delete the old `waitForElement("builder_platform_interaction-left-panel")` path and nested query chain.

- [ ] **Step 4: Run Flow Builder and lifecycle tests**

```bash
npm test -- tests/flowMainUI.test.js tests/domLifecycle.test.js
```

Expected: all pass.

- [ ] **Step 5: Run the full suite/build**

```bash
npm test
npm run build
```

Expected: exit code 0.

- [ ] **Step 6: Commit Flow Builder resilience**

```bash
git add src/scripts/flowMainUI.js tests/flowMainUI.test.js
git commit -m "fix: reapply Flow Builder sidebar sizing after rerenders"
```

---

### Task 7: Harden Installed Packages initialization and sorting

**Files:**
- Modify: `src/scripts/installedPackages.js`
- Create: `tests/installedPackages.test.js`

**Interfaces:**
- Consumes: `waitForElement` and `addGlobalStyle`.
- Produces: exported `initializeInstalledPackages(table)`, `startInstalledPackages(options?)`, and retained sorting helpers rooted to a concrete table.
- Idempotency marker: `data-salesforce-improved-initialized="true"` on the initialized table.

- [ ] **Step 1: Write Installed Packages regression tests**

Create `tests/installedPackages.test.js` with a reusable fixture:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initializeInstalledPackages,
  startInstalledPackages,
} from "@/scripts/installedPackages";

function tableFixture() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <table class="list">
      <thead>
        <tr class="headerRow"><th>Name</th><th>Status</th><th>Publisher</th></tr>
      </thead>
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
  });

  it("exits without throwing when the table never appears", async () => {
    vi.useFakeTimers();
    const promise = startInstalledPackages({ timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).resolves.toBeNull();
    vi.useRealTimers();
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

  it("does not nest header anchors on repeated initialization", () => {
    const table = tableFixture();
    document.body.append(table);

    initializeInstalledPackages(table);
    initializeInstalledPackages(table);

    expect(table.querySelectorAll("tr.headerRow th a a")).toHaveLength(0);
    expect(table.querySelectorAll("tr.headerRow th > a")).toHaveLength(3);
  });

  it("does not attach duplicate click behavior", () => {
    const table = tableFixture();
    document.body.append(table);

    initializeInstalledPackages(table);
    initializeInstalledPackages(table);

    expect(table.dataset.salesforceImprovedInitialized).toBe("true");
  });
});
```

- [ ] **Step 2: Run tests and verify the missing-table path fails**

```bash
npm test -- tests/installedPackages.test.js
```

Expected: FAIL because current module synchronously obtains `table`, calls `sortRows(null, 2)`, and has no asynchronous/idempotent initializer.

- [ ] **Step 3: Refactor all table operations to accept a concrete table root**

Keep the existing style rules and Task 4 stable style ID. Change helper signatures to:

```js
function replaceRowDividers(table) { ... }
function addSortableClass(table) { ... }
function replaceTableHeaderWithTableData(table) { ... }
function makeSortable(table) { ... }
function sortRows(table, columnIndex) { ... }
```

Every query that belongs to the Installed Packages table should be rooted at `table`, e.g.:

```js
const rows = table.querySelectorAll("tbody tr.dataRow");
```

Do not use document-wide `querySelectorAll("table.sortable")` after a specific table has already been resolved.

- [ ] **Step 4: Make header wrapping and click handling idempotent**

Implement the sortable header logic with one table-level initialization marker:

```js
function makeSortable(table) {
  const headerRow = table.querySelector("tr.headerRow");
  if (!headerRow) return;

  headerRow.querySelectorAll("th").forEach((header) => {
    if (header.firstElementChild?.matches("a[data-salesforce-improved-sort-link]")) {
      return;
    }

    const link = document.createElement("a");
    link.href = "#";
    link.dataset.salesforceImprovedSortLink = "true";
    while (header.firstChild) link.appendChild(header.firstChild);
    header.appendChild(link);
  });

  headerRow.addEventListener("click", sortTableFunction(table));
}
```

Use a robust event target in `sortTableFunction`:

```js
function sortTableFunction(table) {
  return (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[data-salesforce-improved-sort-link]");
    if (!link) return;

    sortRows(table, siblingIndex(link.parentElement));
    event.preventDefault();
  };
}
```

Guard `link.parentElement` before calling `siblingIndex`; if it is absent, return.

- [ ] **Step 5: Make sorting fail open when expected structure is missing**

Use this shape:

```js
function sortRows(table, columnIndex) {
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = table.querySelectorAll("tbody tr");
  const selector = `td:nth-child(${columnIndex + 1})`;
  const values = [];

  rows.forEach((row) => {
    const node = row.querySelector(selector);
    if (node) values.push({ value: node.textContent ?? "", row });
  });

  values.sort((a, b) => a.value.localeCompare(b.value));
  values.forEach(({ row }) => tbody.appendChild(row));
}
```

Keep the existing `th[scope='row']` → `td.dataCell` transformation behavior, but guard every missing expected node.

- [ ] **Step 6: Add the explicit initializer and bounded startup**

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

export async function startInstalledPackages({ timeoutMs = 10_000 } = {}) {
  const table = await waitForElement("table.list", { timeoutMs });
  if (!table) return null;
  return initializeInstalledPackages(table);
}

void startInstalledPackages();
```

- [ ] **Step 7: Run Installed Packages tests**

```bash
npm test -- tests/installedPackages.test.js
```

Expected: all pass.

- [ ] **Step 8: Run full tests/build**

```bash
npm test
npm run build
```

Expected: exit code 0.

- [ ] **Step 9: Commit Installed Packages hardening**

```bash
git add src/scripts/installedPackages.js tests/installedPackages.test.js
git commit -m "fix: harden Installed Packages DOM handling"
```

---

### Task 8: Preserve login-page node identity and guard missing containers

**Files:**
- Modify: `src/scripts/loginPage.js`
- Create: `tests/loginPage.test.js`

**Interfaces:**
- Produces: exported `moveSavedLoginsEditorToRight()` and `sortSavedUsernames()` for deterministic tests.
- Preserves: existing login layout/clone structure except `#manager` itself is moved, not cloned.

- [ ] **Step 1: Write login-page regression tests**

Create `tests/loginPage.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  moveSavedLoginsEditorToRight,
  sortSavedUsernames,
} from "@/scripts/loginPage";

describe("login page behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the original saved-login manager and preserves listeners", () => {
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

If the current `sortSavedUsernames()` considers one child to be the no-login case, retain that fixture. The purpose of the second test is specifically that `#right #content` is absent when the branch is reached.

- [ ] **Step 2: Run tests and verify failure**

```bash
npm test -- tests/loginPage.test.js
```

Expected: the identity/listener test fails because current code clones `#manager`; the missing parent case may throw when assigning `innerHTML`.

- [ ] **Step 3: Move the original `#manager`**

Replace only the cloning logic:

```js
export function moveSavedLoginsEditorToRight() {
  const savedLoginEditor = document.getElementById("manager");
  const rightContainer = document.querySelector("#right #content");

  if (savedLoginEditor && rightContainer) {
    rightContainer.appendChild(savedLoginEditor);
  }
}
```

- [ ] **Step 4: Guard the no-saved-login parent and export the function**

In `sortSavedUsernames()`:

```js
if (sortedLogins.length <= 1) {
  const parentContainer = document.querySelector("div#right #content");
  if (!parentContainer) return;

  parentContainer.innerHTML = `
    <div>
      <h2 style="text-align: center">Salesforce Improved</h2>
      <p style="text-align: center; margin-bottom: 0.83em">No saved logins to display.</p>
    </div>
  `;
  return;
}
```

Export `sortSavedUsernames` and `moveSavedLoginsEditorToRight`. Keep `moveLoginsToRight()` and the existing startup sequence otherwise unchanged.

- [ ] **Step 5: Run login tests and full suite**

```bash
npm test -- tests/loginPage.test.js
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit login-page hardening**

```bash
git add src/scripts/loginPage.js tests/loginPage.test.js
git commit -m "fix: preserve saved-login editor behavior"
```

---

### Task 9: Fix popup UI and development documentation defects

**Files:**
- Modify: `src/App.tsx`
- Modify: `README.md`
- Modify: `components.json`

**Interfaces:**
- Preserves: popup layout and Settings button behavior.
- Changes: icon uses valid Tailwind dimensions and alt text; GitHub link opens a normal tab.

- [ ] **Step 1: Correct popup markup**

In `src/App.tsx`, change the icon to:

```tsx
<img
  src={icon}
  className="w-12 h-12"
  alt="Salesforce Improved extension icon"
/>
```

Change the GitHub anchor to:

```tsx
<a
  href="https://github.com/mselchow/salesforce-improved-extension"
  target="_blank"
  rel="noreferrer"
  className="underline"
>
  GitHub
</a>
```

Do not redesign the popup or alter the Settings button behavior.

- [ ] **Step 2: Correct README unpacked-extension instructions**

Replace the current split instruction that says `src` should be loaded after `npm run dev`. Document that the CRXJS-generated unpacked extension is loaded from `dist` for local development/build output. Include this note immediately after the load-unpacked steps:

```markdown
After installing or updating the extension, refresh any Salesforce tabs that were already open so Chrome loads the new static content scripts on those pages.
```

- [ ] **Step 3: Correct the shadcn stylesheet path for Phase 1**

In `components.json`, change:

```json
"css": "src/globals.css"
```

to:

```json
"css": "src/styles/globals.css"
```

Phase 2 will delete `components.json` if shadcn configuration is no longer used.

- [ ] **Step 4: Verify static UI/docs changes**

Run:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

At this point `npm run lint` still uses the repository's original JS/TS extension list; Task 10 will expand it to TSX and fix any newly exposed lint errors.

Expected: typecheck and build exit 0; record any lint issue rather than weakening rules to hide it.

- [ ] **Step 5: Commit UI/docs cleanup**

```bash
git add src/App.tsx README.md components.json
git commit -m "fix: clean up popup and development docs"
```

---

### Task 10: Add complete local/CI quality gates and generated-manifest verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` only if npm normalizes it while scripts/dependencies are already present; do not upgrade packages here.
- Create: `scripts/verify-manifest.mjs`
- Create: `.github/workflows/check.yml`
- Modify: any files failing Prettier, formatting-only; keep formatting behavior-neutral.
- Modify: `.eslintrc.json` only if required for legitimate TSX parsing/import resolution; do not suppress real errors.

**Interfaces:**
- Produces scripts: `test`, `typecheck`, `lint`, `format:check`, `verify:manifest`, `check`.
- `npm run check` is the required Phase 1 pre-merge gate.

- [ ] **Step 1: Add a generated-manifest verifier before wiring the combined gate**

Create `scripts/verify-manifest.mjs`:

```js
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"),
);

const requiredInstalledPackageMatches = [
  "*://*.salesforce-setup.com/lightning/setup/ImportedPackage/home*",
  "*://*.lightning.force.com/lightning/setup/ImportedPackage/home*",
  "*://*.salesforce.com/0A3?setupid=ImportedPackage*",
];

const failures = [];

if (manifest.background) {
  failures.push("generated manifest must not contain a background service worker");
}

if ((manifest.permissions ?? []).includes("scripting")) {
  failures.push('generated manifest must not request the "scripting" permission');
}

if (manifest.host_permissions) {
  failures.push("generated manifest must not contain host_permissions");
}

const installedPackagesScript = manifest.content_scripts?.find((script) =>
  script.matches?.includes(requiredInstalledPackageMatches[0]),
);

if (!installedPackagesScript) {
  failures.push("generated manifest is missing the modern Installed Packages content script route");
} else {
  for (const match of requiredInstalledPackageMatches) {
    if (!installedPackagesScript.matches?.includes(match)) {
      failures.push(`Installed Packages content script is missing match: ${match}`);
    }
  }

  if (installedPackagesScript.all_frames !== true) {
    failures.push("Installed Packages content script must keep all_frames=true");
  }
}

if (failures.length > 0) {
  throw new Error(`Generated manifest verification failed:\n- ${failures.join("\n- ")}`);
}

console.log("Generated manifest verification passed.");
```

- [ ] **Step 2: Add the complete package scripts**

Change the `scripts` section of `package.json` to include exactly these quality commands while retaining `dev`, `build`, and `preview`:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "lint": "eslint --ext .js,.ts,.tsx .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "verify:manifest": "node scripts/verify-manifest.mjs",
  "check": "npm run test && npm run typecheck && npm run lint && npm run format:check && npm run build && npm run verify:manifest"
}
```

- [ ] **Step 3: Run the newly broadened lint command and fix real TSX errors**

Run:

```bash
npm run lint
```

Expected at the start of this step: the expanded lint may expose the errors Codex reported in TSX files.

Fix each error according to its actual rule. Do not add blanket disables and do not remove `.tsx` from lint scope. Common expected fixes include import ordering/semicolons/unused imports in generated shadcn files; Phase 2 will remove unused components, but Phase 1 must still leave the current tree lint-clean.

- [ ] **Step 4: Run Prettier check and apply isolated formatting only where needed**

Run:

```bash
npm run format:check
```

If it fails, run:

```bash
npx prettier --write <each-file-reported-by-the-check>
```

Use only the file paths actually reported by Prettier. Review `git diff --word-diff=plain` to confirm unrelated changes are formatting-only.

- [ ] **Step 5: Build and run generated-manifest verification directly**

```bash
npm run build
npm run verify:manifest
```

Expected: `Generated manifest verification passed.` and exit code 0.

- [ ] **Step 6: Add GitHub Actions CI**

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

If the existing 2023 toolchain demonstrably fails under Node 22 for a toolchain-only reason, do not silently downgrade CI. Record the incompatibility and resolve it in the smallest compatible way; if Node 20 is temporarily required to establish Phase 1, use Node 20 with a comment stating that Phase 2 must move CI to a maintained Node release during modernization.

- [ ] **Step 7: Run the complete local gate fresh**

Run exactly:

```bash
npm run check
```

Expected:

1. all Vitest tests pass;
2. `tsc --noEmit` exits 0;
3. ESLint exits 0 across JS/TS/TSX;
4. Prettier check exits 0;
5. Vite production build exits 0;
6. generated manifest verification prints its success message and exits 0.

Do not proceed to commit if any subcommand fails.

- [ ] **Step 8: Commit quality gates**

If formatting touched unrelated files, commit that formatting separately first:

```bash
git add <format-only-files>
git commit -m "style: apply project formatting"
```

Then commit gate/config changes:

```bash
git add package.json package-lock.json scripts/verify-manifest.mjs .github/workflows/check.yml .eslintrc.json
git commit -m "chore: enforce project quality gates"
```

Omit `.eslintrc.json` from `git add` if it did not change.

---

### Task 11: Final Phase 1 verification and handoff

**Files:**
- No production changes expected.
- Modify: `README.md` only if the verification steps reveal missing manual smoke-test guidance required by the approved spec.

**Interfaces:**
- Produces: evidence that Phase 1 is ready for PR/review.
- Does not perform Phase 2 modernization.

- [ ] **Step 1: Re-read the approved spec acceptance criteria**

Check each Phase 1 criterion in `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md` against the implementation. Specifically verify:

- background injector absent;
- `scripting` permission absent;
- modern Setup-domain Installed Packages route present;
- popup existing/new tests present and passing;
- missing/async Installed Packages table tests present and passing;
- Flow Builder delayed/replacement tests present and passing;
- login manager identity/listener test present and passing;
- document-start style test present and passing;
- lint covers JS/TS/TSX;
- README and popup defects corrected.

- [ ] **Step 2: Run the full gate again with fresh output**

```bash
npm ci
npm run check
```

Expected: exit code 0 for both commands.

- [ ] **Step 3: Inspect the branch diff for scope creep**

```bash
git diff --stat fix/staging-review-remediation...HEAD
git diff fix/staging-review-remediation...HEAD
```

Confirm that changes are limited to this Phase 1 plan. In particular, there should be no broad dependency/toolchain upgrades beyond adding the pinned Phase 1 Vitest/jsdom test dependencies.

- [ ] **Step 4: Perform manual Chrome/Salesforce smoke tests only if authenticated access is available**

When available, load `dist` as an unpacked extension and check:

1. ordinary Lightning page;
2. Setup home on the current `salesforce-setup.com` domain;
3. Lightning App Builder;
4. Flow Builder;
5. Flow Debug;
6. Installed Packages;
7. Salesforce login/saved-login page.

For install/update behavior, leave representative tabs open during an extension reload/update, confirm there is no service-worker injection exception, refresh those Salesforce tabs, and verify each applicable static content script takes effect once.

If authenticated Salesforce access is not available, explicitly report this checklist as **not executed** rather than inferring success from jsdom tests.

- [ ] **Step 5: Stop before Phase 2**

Do not execute `docs/superpowers/plans/2026-09-10-staging-review-toolchain-modernization.md` until this Phase 1 branch has a green `npm run check` and has been reviewed/accepted as the behavioral baseline.
