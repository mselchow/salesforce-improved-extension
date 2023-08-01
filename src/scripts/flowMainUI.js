import addGlobalStyle from "../lib/addGlobalStyle";
import waitForElement from "../lib/waitForElement";

addGlobalStyle(`
  /* increase width of modals to improve width/visibility of dropdown menus */
  .uiModal--medium .modal-container {
    max-width: 70vw !important;
  }

  /* increase height of debug modal to improve visibility */
  .slds-modal__content {
    max-height: 75vh !important;
  }

  /* increase width of debug modal to improve visibility */
  .uiModal--small .modal-container {
    max-width: 50vw !important;
  }

  /* allow record selection combo box to overflow container */
  div .slds-modal__content > div .lookup__menu.uiInput {
    position: fixed !important;
  }
`);

waitForElement("builder_platform_interaction-container-common").then(() => {
  increaseSidebar();
});

function increaseSidebar() {
  const sidebar = document
    .querySelector("builder_platform_interaction-container-common")
    ?.querySelector(".editor")
    ?.querySelector("div.slds-grid")
    ?.querySelector("div.slds-col")
    ?.firstChild?.querySelector(".left-panel");

  if (sidebar) {
    sidebar.classList?.remove("slds-size_medium");
    sidebar.classList?.add("slds-size_large");
  }
}
