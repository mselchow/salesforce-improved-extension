import { ExtensionOptions } from "@/options/OptionsForm";

export default function getExtensionStorage(): ExtensionOptions {
  const options: ExtensionOptions = {
    general: {
      isPopupsMinimized: true,
    },
    loginPage: {
      isRecentLoginsOnRight: true,
      isRecentLoginsAlphabetized: true,
      isRecentLoginsCleanedUp: true,
    },
    lightningPages: {
      isWalkthroughTipsHidden: true,
      isAppExchangeLinkHidden: true,
      isPopupsHidden: true,
    },
    flow: {
      isModalWidthIncreased: true,
      isDebugDropdownOverflow: true,
      isSidebarWidthIncreased: true,
      isFormulaHeightIncreased: true,
      isFormulaFontMonospace: true,
    },
    setup: {
      isManagedPackagesSorted: true,
    },
  };

  chrome.storage.sync.get(options, () => {
    if (chrome.runtime.lastError) {
      console.log(
        "Salesforce Improved -- error getting options from storage: " +
          chrome.runtime.lastError,
      );
    } else {
      console.log(options);
      return options;
    }
  });

  return options;
}
