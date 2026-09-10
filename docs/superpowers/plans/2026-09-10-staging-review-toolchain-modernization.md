# Staging Review Toolchain Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:verification-before-completion before every commit or completion claim.

**Goal:** Reduce the stale dependency and build-tool surface identified by the staging review while preserving the Phase 1 behavioral baseline and avoiding unsupported forced upgrades.

**Architecture:** Prune abandoned shadcn/form infrastructure before upgrading anything so unused packages stop constraining the graph. Then upgrade the remaining toolchain in compatibility groups—CRXJS/Vite, TypeScript/types, ESLint/typescript-eslint, and remaining React/Tailwind support packages—with a fresh `npm run check` after every group. The generated Chrome manifest is treated as an output contract and must remain unchanged in behavior except where the approved spec already changed it.

**Tech Stack:** npm, CRXJS, Vite, TypeScript, React, Tailwind/PostCSS, ESLint/typescript-eslint, Vitest/jsdom, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- Start only after `docs/superpowers/plans/2026-09-10-staging-review-runtime-reliability.md` is implemented and `npm run check` passes.
- Do not use `npm audit fix --force`.
- Remove unused packages before upgrading retained packages.
- Upgrade one compatibility group at a time and commit only after the full Phase 1 gate passes.
- Prefer the newest mutually compatible stable package set available at execution time; do not select prerelease/canary/RC versions unless a retained dependency explicitly requires one.
- Preserve all Phase 1 tests and generated-manifest invariants.
- If a candidate major requires unrelated product refactoring, stop at the newest supported lower major and document why instead of expanding scope.
- As of plan creation on 2026-09-10, registry/reference candidates include CRXJS `2.7.1`, Vite `8.2.2`, TypeScript `7.0.2`, ESLint `10.10.0`, and `@typescript-eslint/parser`/plugin `8.70.0`; execution must still verify current dist-tags and peer ranges rather than assuming those versions remain current.

---

## File Structure

### Files expected to be deleted during pruning

- `src/components/ui/button.tsx` — remove after replacing the popup's single shadcn Button usage.
- `src/components/ui/form.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/use-toast.ts`
- `src/options/OptionsFormItem.tsx` — unused placeholder component.
- `src/lib/utils.ts` — remove if code search confirms no consumer remains after deleting shadcn Button.
- `components.json` — remove when shadcn configuration is no longer used.

### Files expected to be modified

- `src/App.tsx` — replace shadcn Button with a native styled button while preserving behavior.
- `package.json` / `package-lock.json` — prune unused packages and perform controlled upgrades.
- `vite.config.ts` — only if required by the selected stable CRXJS/Vite compatibility pair.
- `tsconfig.json` / `tsconfig.node.json` — only for required TypeScript compatibility changes.
- `.eslintrc.json` or replacement `eslint.config.js` — migrate only when required by the selected ESLint major.
- `tailwind.config.js`, `postcss.config.cjs`, `src/styles/globals.css` — only if retained Tailwind/PostCSS upgrades require syntax/config migration.
- `.github/workflows/check.yml` — move CI to Node 22 if Phase 1 temporarily used Node 20; otherwise retain Node 22.
- `README.md` — add a short dependency/audit maintenance note only if needed to record a deliberate version ceiling or remaining audit exposure.

### Files created if ESLint 10 is selected

- `eslint.config.js` — flat-config replacement for `.eslintrc.json`.

---

### Task 1: Establish the Phase 2 baseline and inventory the retained graph

**Files:**
- No changes expected.

**Interfaces:**
- Consumes: completed Phase 1 `npm run check` gate.
- Produces: a concrete list of direct packages to remove and candidate stable versions/peer ranges for retained packages.

- [ ] **Step 1: Verify the Phase 1 baseline before touching dependencies**

Run:

```bash
npm ci
npm run check
```

Expected: both commands exit 0. If either fails, stop Phase 2 and repair/review Phase 1 rather than upgrading around a broken baseline.

- [ ] **Step 2: Inventory direct dependencies and actual source imports**

Run:

```bash
npm ls --depth=0
rg -n "@hookform/resolvers|@radix-ui|class-variance-authority|clsx|lucide-react|react-hook-form|tailwind-merge|tailwindcss-animate|zod|@/components/ui|@/lib/utils|OptionsFormItem" src package.json tailwind.config.js
```

Expected from the approved source shape:

- `src/App.tsx` is the retained consumer of `src/components/ui/button.tsx`;
- `src/options/OptionsFormItem.tsx` consumes shadcn form primitives but is not used by `OptionsForm.tsx`;
- the placeholder options page itself is plain React/Tailwind;
- `src/lib/utils.ts` exists to support shadcn class merging.

If code search finds another retained consumer, do not delete its dependency until that consumer has an explicit replacement in Task 2.

- [ ] **Step 3: Record current stable dist-tags and peer requirements**

Run:

```bash
npm view @crxjs/vite-plugin version peerDependencies engines
npm view vite version engines
npm view typescript version engines
npm view eslint version engines
npm view @typescript-eslint/parser version peerDependencies engines
npm view @typescript-eslint/eslint-plugin version peerDependencies engines
npm view eslint-plugin-import version peerDependencies engines
npm view eslint-import-resolver-typescript version peerDependencies engines
npm view @vitejs/plugin-react version peerDependencies engines
npm view react version engines
npm view react-dom version peerDependencies engines
npm view tailwindcss version engines
npm view postcss version engines
npm view autoprefixer version engines
```

Write the command output into the implementation session notes; do not commit a generated inventory file unless the executor needs it for review.

- [ ] **Step 4: Capture the pre-modernization audit baseline**

Run:

```bash
npm audit --json > /tmp/salesforce-improved-audit-before.json || true
node -e 'const a=require("/tmp/salesforce-improved-audit-before.json"); console.log(JSON.stringify(a.metadata?.vulnerabilities ?? {}, null, 2))'
```

Expected: this establishes the starting advisory counts without treating `npm audit`'s nonzero status as a build failure.

Do not run `npm audit fix` in this task.

---

### Task 2: Remove abandoned shadcn/form UI infrastructure

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/ui/button.tsx`
- Delete: `src/components/ui/form.tsx`
- Delete: `src/components/ui/input.tsx`
- Delete: `src/components/ui/label.tsx`
- Delete: `src/components/ui/switch.tsx`
- Delete: `src/components/ui/toast.tsx`
- Delete: `src/components/ui/toaster.tsx`
- Delete: `src/components/ui/use-toast.ts`
- Delete: `src/options/OptionsFormItem.tsx`
- Delete: `src/lib/utils.ts` if code search confirms no remaining consumer
- Delete: `components.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tailwind.config.js`

**Interfaces:**
- Preserves: popup Settings action via `chrome.runtime.openOptionsPage()` with the same fallback.
- Removes: shadcn-specific component/config surface and packages used only by deleted files.

- [ ] **Step 1: Replace the shadcn Button with a native button before deleting its implementation**

In `src/App.tsx`, remove:

```tsx
import { Button } from "@/components/ui/button";
```

Replace the existing `<Button ...>Settings</Button>` with:

```tsx
<button
  type="button"
  className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  onClick={() => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/index.html"));
    }
  }}
>
  Settings
</button>
```

This intentionally preserves the current default Button appearance without retaining `class-variance-authority`, Radix Slot, `clsx`, or `tailwind-merge` solely for one button.

- [ ] **Step 2: Verify no retained source file imports the deletion candidates**

Run:

```bash
rg -n "@/components/ui|@/lib/utils|OptionsFormItem|@hookform/resolvers|@radix-ui|class-variance-authority|clsx|lucide-react|react-hook-form|tailwind-merge|zod" src
```

Expected after the App edit: only files that are themselves deletion candidates may appear. If a retained file appears, stop and preserve the required file/package until its use is understood.

- [ ] **Step 3: Delete the unused files**

Run:

```bash
git rm \
  src/components/ui/button.tsx \
  src/components/ui/form.tsx \
  src/components/ui/input.tsx \
  src/components/ui/label.tsx \
  src/components/ui/switch.tsx \
  src/components/ui/toast.tsx \
  src/components/ui/toaster.tsx \
  src/components/ui/use-toast.ts \
  src/options/OptionsFormItem.tsx \
  components.json
```

If Step 2 confirms `src/lib/utils.ts` has no remaining consumer, also run:

```bash
git rm src/lib/utils.ts
```

- [ ] **Step 4: Remove direct dependencies whose only consumers were deleted**

Run:

```bash
npm uninstall \
  @hookform/resolvers \
  @radix-ui/react-label \
  @radix-ui/react-slot \
  @radix-ui/react-switch \
  @radix-ui/react-toast \
  class-variance-authority \
  clsx \
  lucide-react \
  react-hook-form \
  tailwind-merge \
  zod
```

`tailwindcss-animate` is handled separately in Step 5 because it is referenced by `tailwind.config.js` rather than application imports.

- [ ] **Step 5: Remove the unused Tailwind animation plugin/config together**

Delete this from `tailwind.config.js`:

```js
keyframes: {
  "accordion-down": {
    from: { height: 0 },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: 0 },
  },
},
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
},
```

Change:

```js
plugins: [require("tailwindcss-animate")],
```

to:

```js
plugins: [],
```

Then run:

```bash
npm uninstall tailwindcss-animate
```

- [ ] **Step 6: Verify no removed package/import survives**

Run:

```bash
rg -n "@hookform/resolvers|@radix-ui|class-variance-authority|clsx|lucide-react|react-hook-form|tailwind-merge|tailwindcss-animate|zod|@/components/ui|@/lib/utils|OptionsFormItem" src package.json tailwind.config.js || true
```

Expected: no matches.

- [ ] **Step 7: Run the full Phase 1 gate**

```bash
npm run check
```

Expected: exit code 0. Fix only issues caused by the pruning; do not begin package upgrades in this task.

- [ ] **Step 8: Commit the prune**

```bash
git add src/App.tsx package.json package-lock.json tailwind.config.js
git add -u
git commit -m "refactor: remove unused UI dependencies"
```

---

### Task 3: Upgrade the CRXJS/Vite build compatibility group

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts` only if required by the selected stable versions
- Modify: `.github/workflows/check.yml` only if Node runtime requirements change

**Interfaces:**
- Preserves: current `vite.config.ts` plugin composition `react(), crx({ manifest })`, `@` alias, `dist/manifest.json` invariants, and all Phase 1 tests.

- [ ] **Step 1: Re-check stable versions and compatibility at execution time**

Run:

```bash
npm view @crxjs/vite-plugin version peerDependencies engines
npm view vite version engines
npm view @vitejs/plugin-react version peerDependencies engines
```

Selection rule:

1. choose the latest stable `@crxjs/vite-plugin`;
2. choose the latest stable Vite major accepted by that CRXJS peer range;
3. choose the latest stable `@vitejs/plugin-react` whose peer range accepts that Vite major;
4. choose an active Node release accepted by all three; prefer Node 22 if accepted.

At plan creation, CRXJS `2.7.1` explicitly includes Vite 8 compatibility work, and Vite `8.2.2` is stable. These are the expected candidates, not hard requirements if registry state changes.

- [ ] **Step 2: Install only the selected build trio**

Use exact versions from Step 1, for example if the expected candidates remain compatible:

```bash
npm install --save-dev @crxjs/vite-plugin@2.7.1 vite@8.2.2 @vitejs/plugin-react@latest
```

Before accepting `@latest`, verify the resolved package version and peer range printed by npm/`npm ls`; if it resolves to a prerelease, install the latest stable numeric version instead.

Do not upgrade TypeScript, ESLint, React, Tailwind, or Vitest in this task.

- [ ] **Step 3: Resolve only build-API changes required by the selected majors**

Run:

```bash
npm run build
```

If Vite/CRXJS reports a changed config API, make the smallest required change in `vite.config.ts`. Preserve:

```ts
plugins: [react(), crx({ manifest })]
```

and the `@` alias semantics. Do not redesign the build configuration.

- [ ] **Step 4: Verify the generated manifest contract**

```bash
npm run verify:manifest
```

Expected: exit code 0 with the same Phase 1 manifest invariants.

- [ ] **Step 5: Run the full gate**

```bash
npm run check
```

Expected: exit code 0. If the selected Vite major breaks a retained plugin with no supported fix in the selected CRXJS release, revert this task and choose the newest lower stable Vite major supported by both CRXJS and `@vitejs/plugin-react`.

- [ ] **Step 6: Commit the build-tool upgrade**

```bash
git add package.json package-lock.json vite.config.ts .github/workflows/check.yml
git commit -m "chore: modernize CRXJS and Vite"
```

Omit unchanged files from `git add`.

---

### Task 4: Upgrade TypeScript and type packages to the newest compatible stable set

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json` only for required compiler-option migration
- Modify: `tsconfig.node.json` only for required compiler-option migration

**Interfaces:**
- Preserves: strict type checking, `noEmit`, bundler module resolution, `@/*` path aliases, React JSX transform.

- [ ] **Step 1: Inspect TypeScript candidate and downstream parser compatibility**

Run:

```bash
npm view typescript version engines
npm view @typescript-eslint/parser version peerDependencies
npm view @typescript-eslint/typescript-estree version peerDependencies
npm view @types/node version
npm view @types/react version
npm view @types/react-dom version
npm view @types/chrome version
```

Selection rule:

- Prefer the newest stable TypeScript version supported by the currently installed or next Task 5 stable typescript-eslint line.
- Do **not** install TypeScript 7 solely because it is the registry latest if the chosen typescript-eslint stable release does not declare support for it.
- If TypeScript 7 is unsupported by the stable lint stack, use the newest stable TypeScript 6.x release that is supported and record that deliberate ceiling in the final audit note.

- [ ] **Step 2: Install TypeScript and type packages as one compatibility group**

Run with the versions selected above, e.g.:

```bash
npm install --save-dev \
  typescript@<selected-stable-version> \
  @types/node@<selected-stable-version> \
  @types/react@<selected-stable-version> \
  @types/react-dom@<selected-stable-version> \
  @types/chrome@<selected-stable-version>
```

Replace each `<selected-stable-version>` with the exact numeric version returned/selected in Step 1 before running the command; do not commit literal placeholders.

- [ ] **Step 3: Run typecheck and address only compiler-version migrations**

```bash
npm run typecheck
```

If a compiler option was removed/renamed by the selected TypeScript major, update only the affected option in `tsconfig.json` / `tsconfig.node.json`. Preserve strictness rather than disabling new checks globally.

- [ ] **Step 4: Run full gate**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 5: Commit the TypeScript group**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json
git commit -m "chore: modernize TypeScript tooling"
```

Omit unchanged tsconfig files.

---

### Task 5: Upgrade ESLint/typescript-eslint and migrate to flat config if required

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `.eslintrc.json` if ESLint 10 is selected
- Create: `eslint.config.js` if ESLint 10 is selected

**Interfaces:**
- Preserves: lint coverage for `.js`, `.ts`, `.tsx`; `eslint:recommended`-equivalent core rules; typescript-eslint recommended rules; import resolution/order rules.

- [ ] **Step 1: Resolve a mutually compatible lint stack**

Run:

```bash
npm view eslint version engines
npm view @typescript-eslint/parser version peerDependencies engines
npm view @typescript-eslint/eslint-plugin version peerDependencies engines
npm view eslint-plugin-import version peerDependencies engines
npm view eslint-import-resolver-typescript version peerDependencies engines
```

Selection rule:

1. choose the newest stable ESLint major supported by stable `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`;
2. ensure the import plugin/resolver explicitly support that ESLint major;
3. if ESLint 10 is not supported by one retained lint dependency, use ESLint 9 rather than forcing peer overrides.

At plan creation, ESLint `10.10.0` and typescript-eslint `8.70.0` are current stable candidates; peer ranges must decide whether they can be combined.

- [ ] **Step 2: Install the selected lint compatibility set**

Use exact numeric versions selected in Step 1:

```bash
npm install --save-dev \
  eslint@<selected-eslint> \
  @typescript-eslint/parser@<selected-typescript-eslint> \
  @typescript-eslint/eslint-plugin@<selected-typescript-eslint> \
  eslint-plugin-import@<selected-import-plugin> \
  eslint-import-resolver-typescript@<selected-import-resolver>
```

Replace placeholders with exact numbers before execution.

- [ ] **Step 3: If selected ESLint requires flat config, replace `.eslintrc.json`**

For ESLint 10, delete `.eslintrc.json` and create `eslint.config.js` with this semantic equivalent:

```js
import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "import/no-unresolved": "error",
      "import/order": [
        "error",
        {
          groups: [
            "type",
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];
```

Install `@eslint/js` at the exact version matching the selected ESLint major if it is not already pulled in as a direct dev dependency required by the flat config:

```bash
npm install --save-dev @eslint/js@<selected-eslint>
```

If the selected ESLint major still supports and prefers legacy config for this stack, keep `.eslintrc.json` and do not create flat config merely for churn.

- [ ] **Step 4: Run lint and resolve migration-specific errors without weakening coverage**

```bash
npm run lint
```

Fix import/config syntax changes required by the new lint stack. Do not add global rule disables simply to reproduce an old false-negative lint state.

- [ ] **Step 5: Run full gate**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 6: Commit the lint-stack upgrade**

```bash
git add package.json package-lock.json eslint.config.js .eslintrc.json
git commit -m "chore: modernize ESLint tooling"
```

Add only whichever config file actually exists/changed.

---

### Task 6: Upgrade remaining retained React/Tailwind/PostCSS packages conservatively

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tailwind.config.js` only if required
- Modify: `postcss.config.cjs` only if required
- Modify: `src/styles/globals.css` only if required
- Modify: `src/main.tsx` / `src/options/index.tsx` only if required by the selected React major

**Interfaces:**
- Preserves: popup/options rendering and existing Tailwind utility semantics.

- [ ] **Step 1: Resolve stable candidate versions and peer relationships**

Run:

```bash
npm view react version engines
npm view react-dom version peerDependencies engines
npm view tailwindcss version engines
npm view postcss version engines
npm view autoprefixer version engines
```

Use `npm outdated` to identify any other remaining direct dependencies:

```bash
npm outdated || true
```

- [ ] **Step 2: Upgrade React/ReactDOM only if the stable major is compatible with the existing root API**

The code already uses `react-dom/client` and `createRoot`. Install React and ReactDOM as a matched stable pair:

```bash
npm install react@<selected-react> react-dom@<selected-react-dom>
```

Replace placeholders with exact stable numeric versions selected in Step 1.

If the selected React major requires source changes, make only documented API migrations required for `createRoot`/StrictMode; do not redesign popup/options rendering.

- [ ] **Step 3: Run full gate after React group**

```bash
npm run check
```

Expected: exit code 0 before touching Tailwind/PostCSS.

- [ ] **Step 4: Upgrade Tailwind/PostCSS/autoprefixer only as a compatible group**

Before installing a new Tailwind major, check its official package/config migration requirements. If the latest stable Tailwind major requires a broad CSS/config rewrite, prefer the newest stable release within the current configuration model unless the migration is mechanical and does not alter the UI.

Install the selected versions:

```bash
npm install --save-dev \
  tailwindcss@<selected-tailwind> \
  postcss@<selected-postcss> \
  autoprefixer@<selected-autoprefixer>
```

Apply only required config syntax changes in `tailwind.config.js`, `postcss.config.cjs`, or `src/styles/globals.css`.

- [ ] **Step 5: Run full gate after styling toolchain group**

```bash
npm run check
```

Expected: exit code 0 and no intentional visual behavior changes.

- [ ] **Step 6: Upgrade any remaining direct package one at a time**

For each entry still reported by:

```bash
npm outdated || true
```

inspect its stable version and peer requirements, upgrade it alone, then run:

```bash
npm run check
```

Do not batch unrelated remaining packages into one opaque lockfile change.

- [ ] **Step 7: Commit retained runtime/style package modernization**

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.cjs src/styles/globals.css src/main.tsx src/options/index.tsx
git commit -m "chore: modernize retained frontend dependencies"
```

Omit unchanged files.

---

### Task 7: Re-run audit, classify remaining advisories, and finalize Node/CI runtime

**Files:**
- Modify: `.github/workflows/check.yml` if Node 22 is not already used
- Modify: `README.md` only if a deliberate version ceiling or residual advisory needs durable documentation
- Create: `docs/dependency-audit-2026-09-10.md`

**Interfaces:**
- Produces: final audit classification and a reproducible supported toolchain state.

- [ ] **Step 1: Reinstall from lockfile and run the final full gate on the selected CI Node version**

Use the same Node major configured in `.github/workflows/check.yml`, preferably Node 22:

```bash
node --version
npm ci
npm run check
```

Expected: all commands exit 0.

- [ ] **Step 2: Capture final direct dependency state**

```bash
npm ls --depth=0
npm outdated || true
```

Any intentionally retained older major must have a concrete reason from prior compatibility steps.

- [ ] **Step 3: Capture and summarize final npm audit results**

```bash
npm audit --json > /tmp/salesforce-improved-audit-after.json || true
node -e 'const a=require("/tmp/salesforce-improved-audit-after.json"); console.log(JSON.stringify(a.metadata?.vulnerabilities ?? {}, null, 2))'
```

For each remaining advisory path, inspect:

```bash
npm audit
npm explain <package-name>
```

Classify each remaining advisory as one of:

- shipped runtime dependency;
- development/build-only dependency;
- no patched compatible version available;
- patched version exists but requires an unsupported/breaking major that failed the project gate.

- [ ] **Step 4: Write the audit record**

Create `docs/dependency-audit-2026-09-10.md` with this structure and fill it from actual command output:

```markdown
# Dependency Audit — 2026-09-10

## Verification

- Node: `<actual node --version>`
- `npm ci`: pass
- `npm run check`: pass

## Modernized direct toolchain

| Package | Before | After | Notes |
| --- | --- | --- | --- |
| @crxjs/vite-plugin | 2.0.0-beta line | `<actual>` | `<compatibility note>` |
| vite | 4.4.x | `<actual>` | `<compatibility note>` |
| typescript | 5.1.x | `<actual>` | `<compatibility note>` |
| eslint | 8.45.x | `<actual>` | `<compatibility note>` |

## Removed direct dependencies

List every package removed by Task 2.

## npm audit

- Before: copy the severity counts from `/tmp/salesforce-improved-audit-before.json`.
- After: copy the severity counts from `/tmp/salesforce-improved-audit-after.json`.

## Remaining advisories

For each remaining advisory, record package/path, severity, runtime vs build-only classification, fix availability, and why any available fix was not applied.

## Deliberate version ceilings

Record only packages where a newer stable major was intentionally not selected because peer support or the verified project gate prevented it. If none, write `None`.
```

The angle-bracket values above are instructions for the executor to replace with actual command results before committing; no placeholders may remain in the committed document.

- [ ] **Step 5: Ensure CI uses the verified Node version**

If Phase 1 temporarily used Node 20 and all modernized dependencies support Node 22, change `.github/workflows/check.yml` to:

```yaml
with:
  node-version: 22
  cache: npm
```

Then rerun:

```bash
npm ci
npm run check
```

- [ ] **Step 6: Commit audit documentation and any final CI runtime adjustment**

```bash
git add docs/dependency-audit-2026-09-10.md .github/workflows/check.yml README.md
git commit -m "chore: document dependency audit results"
```

Omit unchanged files.

---

### Task 8: Final Phase 2 verification and scope review

**Files:**
- No changes expected.

**Interfaces:**
- Produces: evidence that modernization preserved Phase 1 behavior and that remaining advisories/version ceilings are explicit.

- [ ] **Step 1: Run verification from a clean install**

```bash
rm -rf node_modules dist
npm ci
npm run check
```

Expected: exit code 0.

- [ ] **Step 2: Confirm dependency pruning actually removed abandoned UI packages**

```bash
npm ls \
  @hookform/resolvers \
  @radix-ui/react-label \
  @radix-ui/react-slot \
  @radix-ui/react-switch \
  @radix-ui/react-toast \
  class-variance-authority \
  clsx \
  lucide-react \
  react-hook-form \
  tailwind-merge \
  tailwindcss-animate \
  zod || true
```

Expected: none are top-level project dependencies and none should remain transitively solely because of deleted project code.

- [ ] **Step 3: Confirm generated extension behavior remains within the approved manifest contract**

```bash
npm run build
npm run verify:manifest
```

Expected: generated manifest verification passes.

- [ ] **Step 4: Review diff against the completed Phase 1 baseline**

```bash
git diff --stat <phase-1-final-commit>...HEAD
git diff <phase-1-final-commit>...HEAD
```

Replace `<phase-1-final-commit>` with the actual SHA of the reviewed Phase 1 baseline before running. Confirm the diff consists only of dependency pruning, toolchain/config migration, necessary compatibility edits, CI runtime changes, and audit documentation.

- [ ] **Step 5: Do not merge solely because `npm audit` count decreased**

The merge criterion is the verified supported toolchain plus the full behavioral gate. Any residual audit entries must match the classifications recorded in `docs/dependency-audit-2026-09-10.md`.
