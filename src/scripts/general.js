minimizePopups();

function minimizePopups() {
  const popups = document.querySelectorAll(
    "div.slds-docked_container.forceDockingPanel.DOCKED"
  );

  if (popups) {
    popups.forEach((popup) => {
      popup.classList.replace("DOCKED", "MINIMIZED");
    });
  }
}
