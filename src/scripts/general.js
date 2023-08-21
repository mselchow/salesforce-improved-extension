import waitForElement from "@/lib/waitForElement";

const _POPUP_SELECTOR = "div.slds-docked_container.forceDockingPanel.DOCKED";

waitForElement(_POPUP_SELECTOR, minimizePopups);

function minimizePopups() {
  const popups = document.querySelectorAll(_POPUP_SELECTOR);

  if (popups) {
    popups.forEach((popup) => {
      popup.classList.replace("DOCKED", "MINIMIZED");
    });
  }
}
