import addGlobalStyle from "../lib/addGlobalStyle";

addGlobalStyle(`
  .uiModal--medium .modal-container {
    max-width: 70vw !important;
  }

  .slds-panel {
    overflow-y: scroll !important;
  }
`);

setTimeout(increaseSidebar, 5000);

function increaseSidebar() {
  const sidebar = document
    .querySelector("builder_platform_interaction-container-common")
    .shadowRoot.querySelector(".editor")
    .shadowRoot.querySelector("div.slds-grid")
    .querySelector("div.slds-col")
    .firstChild.shadowRoot.querySelector(".left-panel");
  sidebar.classList.remove("slds-size_medium");
  sidebar.classList.add("slds-size_large");
}
