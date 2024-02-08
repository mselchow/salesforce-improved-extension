import waitForElement from "@/lib/waitForElement";

const _POPUP_SELECTOR = "div.slds-docked_container.forceDockingPanel.DOCKED";
const _POPUPCONTENT_SELECTOR = "div.slds-docked-composer.slds-is-open";

waitForElement(_POPUPCONTENT_SELECTOR, minimizePopups);

function minimizePopups() {
  const popups = document.querySelectorAll(_POPUP_SELECTOR);

  if (popups) {
    popups.forEach((popup) => {
      const popupContent = popup.querySelector(_POPUPCONTENT_SELECTOR);

      if (popupContent) {
        popup.classList.replace("DOCKED", "MINIMIZED");
        popupContent.classList.remove("slds-is-open");
      }
    });
  }
}
