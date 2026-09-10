# Staging Review Toolchain Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:verification-before-completion before every commit or completion claim.

**Goal:** Reduce the stale dependency and build-tool surface identified by the staging review while preserving the Phase 1 behavioral baseline and avoiding unsupported forced upgrades.

**Architecture:** Prune abandoned shadcn/form infrastructure before upgrading anything so unused packages stop constraining the graph. Then upgrade the remaining toolchain in compatibility groups—CRXJS/Vite/test runner, TypeScript/types, ESLint/typescript-eslint, and retained React/Tailwind support packages—with a fresh `npm run check` after every group. The generated Chrome manifest remains an output contract and must preserve the Phase 1 invariants.

**Tech Stack:** npm, CRXJS 2.7.1, Vite 8.2.2, Vitest 5.0.0, jsdom 30.0.1, TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.70.0, React/ReactDOM 19.3.0, Tailwind CSS 3.4.19 LTS, PostCSS 8.5.28, Autoprefixer 10.5.5, GitHub Actions/Node 22.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- Start only after `docs/superpowers/plans/2026-09-10-staging-review-runtime-reliability.md` is implemented on `fix/staging-review-runtime-reliability`, `npm run check` passes, and that Phase 1 result has been reviewed as the behavioral baseline.
- Execute this plan in a new isolated worktree on branch `chore/staging-review-toolchain-modernization`, based on the reviewed head of `fix/staging-review-runtime-reliability`.
- Do not use `npm audit fix --force` and do not use `--legacy-peer-deps` or package-manager peer overrides to force an unsupported combination.
- Remove unused packages before upgrading retained packages.
- Upgrade one compatibility group at a time and commit only after the full Phase 1 gate passes.
- Use the exact stable versions in this plan unless an `npm view` guard proves the package has been withdrawn/deprecated or its published peer/engine metadata is incompatible. In that case stop that task, document the conflicting metadata, and amend the plan rather than silently choosing another major.
- Preserve all Phase 1 tests and generated-manifest invariants.
- TypeScript is intentionally capped at 6.0.3 in this plan because typescript-eslint 8.70.0 declares TypeScript support `<6.1.0`; TypeScript 7.0.2 is therefore outside the stable lint stack's supported range as of 2026-09-10.
- ESLint is intentionally capped at the 9.39.5 maintenance line because published `eslint-plugin-import@2.32.0` did not declare ESLint 10 support when the plan was authored. Do not use peer overrides to force ESLint 10.
- Tailwind is intentionally capped at the 3.4.19 `v3-lts` line. Tailwind 4 is a broader styling/configuration migration and is not required to remediate the reviewed dependency risk.
- Do not claim authenticated Salesforce smoke testing was performed unless it actually was; Phase 1 DOM behavior tests remain the regression baseline throughout this plan.

---

## File Structure

### Files expected to be deleted during pruning

- `src/components/ui/button.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/use-toast.ts`
- `src/options/OptionsFormItem.tsx`
- `src/lib/utils.ts` after code search confirms no retained consumer
- `components.json`
- `.eslintrc.json` during the ESLint 9 flat-config migration

### Files expected to be modified

- `src/App.tsx` — replace the single shadcn Button with a native styled button while preserving behavior.
- `package.json` / `package-lock.json` — prune unused packages and apply controlled upgrades.
- `vite.config.ts` / `vitest.config.ts` — only changes required by Vite 8/Vitest 5 compatibility.
- `tsconfig.json` / `tsconfig.node.json` — only compiler-option/module-resolution changes required by TypeScript 6.
- `tailwind.config.js` — remove the unused animation plugin/config; otherwise retain Tailwind 3 semantics.
- `postcss.config.cjs` — keep existing plugin semantics while updating retained package versions.
- `.github/workflows/check.yml` — use Node 22 after modernization.
- `README.md` — add a concise maintenance note only if a deliberate version ceiling needs user-visible explanation.

### Files created

- `eslint.config.js` — ESLint 9 flat configuration replacing `.eslintrc.json`.
- `docs/dependency-audit-2026-09-10.md` — before/after audit and deliberate-version-ceiling record.

---

### Task 1: Establish the Phase 2 baseline and verify package metadata

**Files:**
- No repository changes expected.

**Interfaces:**
- Consumes: reviewed `fix/staging-review-runtime-reliability` Phase 1 branch.
- Produces: verified baseline and evidence that the pinned compatibility targets still match registry metadata.

- [ ] **Step 1: Create the isolated Phase 2 branch/worktree**

Use `superpowers:using-git-worktrees` and create `chore/staging-review-toolchain-modernization` from `fix/staging-review-runtime-reliability`. Confirm:

```bash
git branch --show-current
git merge-base --is-ancestor fix/staging-review-runtime-reliability HEAD
```

Expected: current branch is `chore/staging-review-toolchain-modernization`; merge-base command exits 0.

- [ ] **Step 2: Verify the Phase 1 baseline before touching dependencies**

```bash
npm ci
npm run check
```

Expected: both commands exit 0. If either fails, stop Phase 2; do not upgrade around a broken baseline.

- [ ] **Step 3: Verify the pinned build/test package metadata**

Run:

```bash
npm view @crxjs/vite-plugin@2.7.1 version peerDependencies engines
npm view vite@8.2.2 version engines
npm view @vitejs/plugin-react@6.1.1 version peerDependencies engines
npm view vitest@5.0.0 version peerDependencies engines
npm view jsdom@30.0.1 version engines
```

Expected: each exact version is published and its engine/peer metadata admits the selected Vite 8 / Node 22 combination. CRXJS 2.7.1 specifically contains Vite 8/Rolldown compatibility fixes.

If any exact package is unavailable or rejects the combination in published metadata, stop and amend this plan before installing a substitute.

- [ ] **Step 4: Verify the pinned TypeScript/lint metadata**

```bash
npm view typescript@6.0.3 version engines
npm view @typescript-eslint/parser@8.70.0 version peerDependencies engines
npm view @typescript-eslint/eslint-plugin@8.70.0 version peerDependencies engines
npm view eslint@9.39.5 version engines
npm view @eslint/js@9.39.5 version
npm view eslint-plugin-import@2.32.0 version peerDependencies
npm view eslint-import-resolver-typescript@4.4.5 version peerDependencies engines
```

Expected:

- typescript-eslint admits TypeScript 6.0.3 (`>=4.8.4 <6.1.0`);
- typescript-eslint admits ESLint 9;
- published `eslint-plugin-import@2.32.0` admits ESLint 9;
- no peer override is required.

- [ ] **Step 5: Verify retained frontend package metadata**

```bash
npm view react@19.3.0 version engines
npm view react-dom@19.3.0 version peerDependencies engines
npm view tailwindcss@3.4.19 version
npm view postcss@8.5.28 version engines
npm view autoprefixer@10.5.5 version engines
```

Expected: exact versions exist; ReactDOM peers with React 19; Tailwind 3.4.19 remains the v3 LTS line.

- [ ] **Step 6: Capture the pre-modernization direct dependency/audit state**

```bash
npm ls --depth=0 > /tmp/salesforce-improved-deps-before.txt
npm audit --json > /tmp/salesforce-improved-audit-before.json || true
node -e 'const a=require("/tmp/salesforce-improved-audit-before.json"); console.log(JSON.stringify(a.metadata?.vulnerabilities ?? {}, null, 2))'
```

Keep these `/tmp` files through Task 7. Do not commit them.

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
- Delete: `src/lib/utils.ts` if Step 2 confirms no remaining consumer
- Delete: `components.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tailwind.config.js`

**Interfaces:**
- Preserves: popup Settings action via `chrome.runtime.openOptionsPage()` with the same fallback.
- Removes: shadcn-specific component/config surface and packages used only by deleted files.

- [ ] **Step 1: Replace the shadcn Button with a native button**

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

- [ ] **Step 2: Prove the deletion candidates have no retained consumers**

```bash
rg -n "@/components/ui|@/lib/utils|OptionsFormItem|@hookform/resolvers|@radix-ui|class-variance-authority|clsx|lucide-react|react-hook-form|tailwind-merge|zod" src
```

Expected after the App edit: matches occur only inside files listed for deletion. If a retained file appears, do not delete its dependency until that consumer is explicitly removed or replaced within this task.

Also verify `tslib` is not required by source/compiler configuration:

```bash
rg -n "from [\"']tslib|require\([\"']tslib|importHelpers" src tsconfig*.json package.json
```

Expected: only the `package.json` dependency entry (if any), with no source import and no `importHelpers: true` compiler option.

- [ ] **Step 3: Delete unused UI/config files**

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

git rm src/lib/utils.ts
```

If Step 2 found a retained `src/lib/utils.ts` consumer, omit the second command and preserve the dependencies it needs.

- [ ] **Step 4: Remove direct dependencies whose only consumers were deleted**

When Step 2 matches the expected repository state, run:

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
  zod \
  tslib
```

If `src/lib/utils.ts` had to be retained, preserve `clsx` and `tailwind-merge`. If `tslib` was shown to be required, preserve `tslib`.

- [ ] **Step 5: Remove the unused Tailwind animation plugin/config together**

Delete these `theme.extend` entries from `tailwind.config.js`:

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
  "accordion-up": "accordion-up 0.2s ease-in",
},
```

Use the exact existing animation values from the file when deleting; the point is to remove both `keyframes` and `animation` blocks, not alter other `theme.extend` entries.

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

- [ ] **Step 6: Verify removed imports/packages are gone**

```bash
rg -n "@hookform/resolvers|@radix-ui|class-variance-authority|lucide-react|react-hook-form|tailwindcss-animate|zod|@/components/ui|OptionsFormItem" src package.json tailwind.config.js || true
```

Expected: no matches. `clsx`, `tailwind-merge`, `@/lib/utils`, or `tslib` may appear only if Step 2 proved they still have a retained consumer/config requirement.

- [ ] **Step 7: Run the full Phase 1 gate**

```bash
npm run check
```

Expected: exit code 0. Fix only issues caused by pruning; do not begin package upgrades in this task.

- [ ] **Step 8: Commit the prune**

```bash
git add -A
git commit -m "refactor: remove unused UI dependencies"
```

Before committing, inspect `git status --short` and verify every staged path belongs to Task 2.

---

### Task 3: Upgrade the CRXJS/Vite/Vitest compatibility group

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts` only if Vite 8 requires a mechanical config adjustment
- Modify: `vitest.config.ts` only if Vitest 5 requires a mechanical config adjustment
- Modify: `.github/workflows/check.yml` to Node 22 if Phase 1 temporarily used Node 20

**Interfaces:**
- Preserves: `plugins: [react(), crx({ manifest })]`, the `@` source alias, jsdom test environment, all Phase 1 tests, and generated-manifest invariants.

- [ ] **Step 1: Install the verified build/test group**

```bash
npm install --save-dev \
  @crxjs/vite-plugin@2.7.1 \
  vite@8.2.2 \
  @vitejs/plugin-react@6.1.1 \
  vitest@5.0.0 \
  jsdom@30.0.1
```

Do not upgrade TypeScript, ESLint, React, Tailwind, PostCSS, or Autoprefixer in this task.

- [ ] **Step 2: Verify package resolution has no forced/invalid peers**

```bash
npm ls @crxjs/vite-plugin vite @vitejs/plugin-react vitest jsdom
```

Expected: command exits 0; intended versions are present; npm does not report invalid peer dependencies.

- [ ] **Step 3: Run focused build/test commands and make only required config migrations**

```bash
npm test
npm run build
npm run verify:manifest
```

If Vite 8 or Vitest 5 reports a removed config option, update only that option in `vite.config.ts` or `vitest.config.ts`. Preserve plugin order, alias semantics, and `test.environment: "jsdom"`.

- [ ] **Step 4: Move CI to Node 22 if Phase 1 used Node 20**

Ensure `.github/workflows/check.yml` contains:

```yaml
with:
  node-version: 22
  cache: npm
```

Remove the Phase 1 temporary Node-20 comment if present.

- [ ] **Step 5: Run the full gate**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 6: Commit the build/test upgrade**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts .github/workflows/check.yml
git commit -m "chore: modernize extension build tooling"
```

If any listed config file did not change, omit it from the `git add` command.

---

### Task 4: Upgrade TypeScript and type packages within the stable lint support ceiling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json` only if TypeScript 6 requires a compiler-option migration
- Modify: `tsconfig.node.json` only if TypeScript 6 requires a compiler-option migration

**Interfaces:**
- Preserves: strict checking, `noEmit`, bundler resolution semantics, `@/*` path alias, React JSX transform.

- [ ] **Step 1: Install TypeScript 6.0.3 and current matching type majors**

```bash
npm install --save-dev \
  typescript@6.0.3 \
  @types/node@22 \
  @types/react@19 \
  @types/react-dom@19 \
  @types/chrome@latest
```

TypeScript 7.0.2 is intentionally excluded because typescript-eslint 8.70.0 declares `<6.1.0` support.

- [ ] **Step 2: Verify TypeScript resolution**

```bash
npm ls typescript @types/node @types/react @types/react-dom @types/chrome
npm run typecheck
```

Expected: npm tree exits 0 and `tsc --noEmit` passes.

If TypeScript 6 rejects a removed/renamed compiler option, replace only that option with its documented TypeScript 6 equivalent. Do not reduce `strict`, `noUnusedLocals`, `noUnusedParameters`, or `noFallthroughCasesInSwitch` to make the upgrade pass.

- [ ] **Step 3: Run the full gate**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 4: Commit the TypeScript group**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json
git commit -m "chore: modernize TypeScript tooling"
```

Omit unchanged tsconfig files.

---

### Task 5: Upgrade ESLint/typescript-eslint and migrate to flat config

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `.eslintrc.json`
- Create: `eslint.config.js`

**Interfaces:**
- Preserves: lint coverage for JS/TS/TSX, ESLint recommended rules, typescript-eslint recommended rules, `import/no-unresolved`, and existing import-order semantics.
- Changes: `npm run lint` becomes `eslint .` under flat config.

- [ ] **Step 1: Install the supported ESLint 9 compatibility set**

```bash
npm install --save-dev \
  eslint@9.39.5 \
  @eslint/js@9.39.5 \
  @typescript-eslint/parser@8.70.0 \
  @typescript-eslint/eslint-plugin@8.70.0 \
  eslint-plugin-import@2.32.0 \
  eslint-import-resolver-typescript@4.4.5 \
  globals@latest
```

Do not install ESLint 10 in this plan and do not add peer overrides.

- [ ] **Step 2: Replace legacy ESLint config with flat config**

```bash
git rm .eslintrc.json
```

Create `eslint.config.js`:

```js
import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

const importOrderRule = [
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
];

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.{js,ts,tsx}", "tests/**/*.{js,ts,tsx}", "manifest.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
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
      ...importPlugin.configs.recommended.rules,
      "import/no-unresolved": "error",
      "import/order": importOrderRule,
    },
  },
  {
    files: [
      "*.config.{js,ts,cjs}",
      "vite.config.ts",
      "vitest.config.ts",
      "tailwind.config.js",
      "postcss.config.cjs",
      "scripts/**/*.mjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      "import/no-unresolved": "error",
      "import/order": importOrderRule,
    },
  },
];
```

If `postcss.config.cjs` or `tailwind.config.js` requires CommonJS parser semantics under this config, add a dedicated flat-config block for `**/*.cjs`/that file with `sourceType: "commonjs"`; do not suppress `no-undef` globally.

- [ ] **Step 3: Update the lint script**

In `package.json`, change:

```json
"lint": "eslint --ext .js,.ts,.tsx ."
```

to:

```json
"lint": "eslint ."
```

- [ ] **Step 4: Run lint and correct only real migration findings**

```bash
npm run lint
```

Expected: exit code 0 after resolving config-syntax or newly enforced legitimate lint findings. Do not add broad rule disables or remove TSX/test coverage.

- [ ] **Step 5: Run the full gate**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 6: Commit the lint-stack migration**

```bash
git add package.json package-lock.json eslint.config.js
git add -u .eslintrc.json
git commit -m "chore: modernize ESLint tooling"
```

---

### Task 6: Upgrade retained React and Tailwind 3 support packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.tsx` / `src/options/index.tsx` only if required by React 19 types/runtime
- Modify: `tailwind.config.js` / `postcss.config.cjs` only if package updates expose a compatibility issue

**Interfaces:**
- Preserves: popup/options `createRoot` rendering and all existing Tailwind utility semantics.

- [ ] **Step 1: Upgrade React/ReactDOM as a matched stable pair**

```bash
npm install --save-dev react@19.3.0 react-dom@19.3.0
```

The project already uses `react-dom/client` and `createRoot`, so do not rewrite rendering unless typecheck/build reports a documented React 19 API migration.

- [ ] **Step 2: Run the full gate before touching styling packages**

```bash
npm run check
```

Expected: exit code 0.

- [ ] **Step 3: Upgrade within the existing Tailwind 3/PostCSS configuration model**

```bash
npm install --save-dev \
  tailwindcss@3.4.19 \
  postcss@8.5.28 \
  autoprefixer@10.5.5
```

Do not migrate to Tailwind 4 in this plan.

- [ ] **Step 4: Verify the styling build without changing semantics**

```bash
npm run build
npm run check
```

Expected: both commands exit 0. `tailwind.config.js`, `postcss.config.cjs`, and `src/styles/globals.css` should remain semantically unchanged except for Task 2's removal of the unused animation plugin/config.

- [ ] **Step 5: Check for other direct packages still outdated**

```bash
npm outdated || true
npm ls --depth=0
```

Do not automatically upgrade packages merely because `npm outdated` prints them. The expected deliberate ceilings are TypeScript 6, ESLint 9, and Tailwind 3. Any other outdated direct package requires a specific compatibility reason before being left behind; if it is safe and unrelated to those ceilings, upgrade it in a separate commit and run `npm run check` before committing.

- [ ] **Step 6: Commit React/styling modernization**

```bash
git add package.json package-lock.json src/main.tsx src/options/index.tsx tailwind.config.js postcss.config.cjs
git commit -m "chore: modernize retained frontend dependencies"
```

Omit unchanged source/config files.

---

### Task 7: Re-run audit and document remaining exposure/ceilings

**Files:**
- Create: `docs/dependency-audit-2026-09-10.md`
- Modify: `.github/workflows/check.yml` only if Node 22 is not already configured

**Interfaces:**
- Produces: a durable before/after audit record grounded in actual npm output.

- [ ] **Step 1: Verify clean-install behavior on Node 22**

```bash
node --version
npm ci
npm run check
```

Expected: Node reports a 22.x release; `npm ci` and `npm run check` exit 0.

- [ ] **Step 2: Capture final dependency and audit state**

```bash
npm ls --depth=0 > /tmp/salesforce-improved-deps-after.txt
npm audit --json > /tmp/salesforce-improved-audit-after.json || true
node -e 'const a=require("/tmp/salesforce-improved-audit-before.json"); console.log("before", a.metadata?.vulnerabilities ?? {})'
node -e 'const a=require("/tmp/salesforce-improved-audit-after.json"); console.log("after", a.metadata?.vulnerabilities ?? {})'
```

If the `/tmp` before files were lost because execution resumed in a new environment, regenerate the **before** counts from the reviewed Phase 1 commit in a temporary detached worktree rather than guessing them.

- [ ] **Step 3: Inspect every remaining advisory path**

Run:

```bash
npm audit
```

For each package named in the remaining audit output, run:

```bash
npm explain PACKAGE_NAME
```

Replace `PACKAGE_NAME` in the shell command with the exact package name printed by `npm audit` before executing it. Classify each advisory as:

1. shipped runtime dependency;
2. development/build-only dependency;
3. no compatible patched version published;
4. patched only by a version outside the supported compatibility set.

- [ ] **Step 4: Create the dependency audit document from actual command output**

Create `docs/dependency-audit-2026-09-10.md` with these exact sections:

```markdown
# Dependency Audit — 2026-09-10

## Verification

## Direct dependency modernization

## Removed direct dependencies

## npm audit before/after

## Remaining advisories

## Deliberate version ceilings
```

Populate every section before committing:

- **Verification:** exact `node --version`; state whether `npm ci` and `npm run check` passed.
- **Direct dependency modernization:** a Markdown table with package, Phase 1 version, final version, and compatibility note. Include at least CRXJS, Vite, Vitest, jsdom, TypeScript, ESLint, typescript-eslint, React, ReactDOM, Tailwind, PostCSS, and Autoprefixer.
- **Removed direct dependencies:** every package removed in Task 2.
- **npm audit before/after:** exact severity counts from the two JSON files.
- **Remaining advisories:** one row per remaining advisory/path with package, severity, runtime vs build-only classification, patched-version availability, and decision.
- **Deliberate version ceilings:** record TypeScript 6.0.3 because typescript-eslint supports `<6.1.0`; ESLint 9.39.5 because the published import-plugin line does not support ESLint 10 without peer forcing; Tailwind 3.4.19 because Tailwind 4 is an out-of-scope styling-system migration. Remove a ceiling from this section only if the corresponding constraint became false and the plan was explicitly amended before execution.

No blank sections, `TBD`, `TODO`, angle-bracket placeholders, or guessed counts may remain.

- [ ] **Step 5: Ensure CI is Node 22**

Confirm `.github/workflows/check.yml` contains:

```yaml
with:
  node-version: 22
  cache: npm
```

If it changes, rerun:

```bash
npm ci
npm run check
```

Expected: exit code 0.

- [ ] **Step 6: Commit the audit record**

```bash
git add docs/dependency-audit-2026-09-10.md .github/workflows/check.yml
git commit -m "chore: document dependency audit results"
```

Omit `.github/workflows/check.yml` if unchanged.

---

### Task 8: Final Phase 2 verification and scope review

**Files:**
- No changes expected.

**Interfaces:**
- Produces: fresh evidence that modernization preserved Phase 1 behavior and that residual risk is documented.

- [ ] **Step 1: Run verification from a clean install**

```bash
rm -rf node_modules dist
npm ci
npm run check
```

Expected: exit code 0.

- [ ] **Step 2: Confirm abandoned UI packages are no longer direct dependencies**

```bash
npm ls \
  @hookform/resolvers \
  @radix-ui/react-label \
  @radix-ui/react-slot \
  @radix-ui/react-switch \
  @radix-ui/react-toast \
  class-variance-authority \
  lucide-react \
  react-hook-form \
  tailwindcss-animate \
  zod --depth=0 || true
```

Expected: none are top-level project dependencies.

If Task 2 removed `src/lib/utils.ts`, also verify:

```bash
npm ls clsx tailwind-merge --depth=0 || true
```

Expected: neither is top-level.

- [ ] **Step 3: Confirm the generated extension contract again**

```bash
npm run build
npm run verify:manifest
```

Expected: generated manifest verification passes.

- [ ] **Step 4: Review the Phase 2 diff against the reviewed Phase 1 baseline**

```bash
git diff --stat fix/staging-review-runtime-reliability...HEAD
git diff fix/staging-review-runtime-reliability...HEAD
```

Confirm the diff consists only of dependency pruning, toolchain/config migration, necessary compatibility edits, CI runtime changes, and audit documentation. No Salesforce content-script behavior should have changed except changes mechanically required to keep Phase 1 tests/build passing.

- [ ] **Step 5: Reconcile the final audit document with current commands**

```bash
npm ls --depth=0
npm audit || true
```

Verify `docs/dependency-audit-2026-09-10.md` matches the current dependency tree and remaining advisories exactly. Correct the document if package changes made earlier counts/classifications stale, then rerun `npm run format:check`.

- [ ] **Step 6: Stop for review**

Do not merge automatically. Hand off the branch with the fresh `npm run check` evidence, audit summary, and any authenticated Salesforce smoke-test status inherited from Phase 1.
