import addGlobalStyle from "../lib/addGlobalStyle";
import waitForElement from "../lib/waitForElement";

addGlobalStyle(`
  /* increase width of modals to improve width/visibility of dropdown menus */
  .uiModal--medium .modal-container {
    max-width: 70vw !important;
  }

  /* allow record selection combo box to overflow container */
  .slds-modal__content {
    overflow: visible !important;
    overflow-y: visible !important;
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
    ?.firstChild.querySelector(".left-panel");

  sidebar.classList.remove("slds-size_medium");
  sidebar.classList.add("slds-size_large");
}
