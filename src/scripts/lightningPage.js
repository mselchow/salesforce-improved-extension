import addGlobalStyle from "../lib/addGlobalStyle";

addGlobalStyle(`
  /* hide pop ups that steal focus */
  .forceDockingPanel.slds-docked_container, .forceDockingPanel.slds-docked-composer-modal {
    display: none !important;
  }

  /* hide walkthrough tips */
  div.walkthroughLauncher {
    display: none !important;
  }

  /* hides AppExchange link */
  button.exchangeLink {
    display: none !important;
  }
`);
