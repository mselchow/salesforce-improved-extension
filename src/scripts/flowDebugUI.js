import addGlobalStyle from "../lib/addGlobalStyle";

addGlobalStyle(`
  /* allow record selection combo box to overflow container */
  .slds-modal__content {
    overflow: visible !important;
    overflow-y: visible !important;
  }
`);
