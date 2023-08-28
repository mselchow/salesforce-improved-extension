import { defineManifest } from "@crxjs/vite-plugin";

import { version } from "./package.json";

// Convert from Semver to Chrome version
const [major, minor, patch] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, "")
  // split into version parts
  .split(/[.-]/);

export const manifest = defineManifest(async (env) => ({
  manifest_version: 3,
  name:
    env.mode === "development"
      ? "[DEV] Salesforce Improved"
      : "Salesforce Improved",
  version: `${major}.${minor}.${patch}`,
  version_name: version,
  description:
    "This extension improves the Salesforce UI by adjusting the layout of some pages to make them more user friendly.",
  permissions: ["scripting"],
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  action: { default_popup: "index.html" },
  background: {
    service_worker: "src/scripts/background.js",
  },
  host_permissions: [
    "*://*.my.salesforce.com/*",
    "*://login.salesforce.com/*",
    "*://test.salesforce.com/*",
    "*://*.force.com/*",
  ],
  options_page: "src/options/index.html",
  content_scripts: [
    {
      js: ["src/scripts/loginPage.js"],
      matches: [
        "*://*.my.salesforce.com/*",
        "*://login.salesforce.com/*",
        "*://test.salesforce.com/*",
      ],
      run_at: "document_idle",
    },
    {
      js: ["src/scripts/general.js"],
      matches: ["*://*.force.com/lightning*"],
      run_at: "document_idle",
    },
    {
      js: ["src/scripts/lightningPage.js"],
      matches: ["*://*.force.com/visualEditor/appBuilder.app*"],
      run_at: "document_idle",
    },
    {
      js: ["src/scripts/flowMainUI.js"],
      matches: [
        "*://*.force.com/builder_platform_interaction/flowBuilder.app*",
      ],
      run_at: "document_idle",
    },
    {
      js: ["src/scripts/flowDebugUI.js"],
      matches: ["*://*.vf.force.com/flow/*"],
      run_at: "document_start",
    },
    {
      js: ["src/scripts/installedPackages.js"],
      matches: ["*://*.salesforce.com/0A3?setupid=ImportedPackage*"],
      run_at: "document_idle",
      all_frames: true,
    },
  ],
}));
