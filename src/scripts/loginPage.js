import addGlobalStyle from "../lib/addGlobalStyle";
import waitForElement from "../lib/waitForElement";

addGlobalStyle(`
  /* hide ads showing in iframe on right side */
    #right iframe {
    display: none !important;
  }

  /* reduce bottom padding of page */
  #main {
    padding-bottom: 24px !important;
  }

  /* decrease extra padding on top of page */
  #wrapper {
    padding-top: 40px !important;
    max-width: 450px !important;
  }

  /* decrease header margin */
  #header {
    margin-top: 0px !important;
  }

  /* increase size of saved usernames display */
    div #chooser .scrollable {
    max-height: 80vh !important;
  }

  /* show the login form on the left */
  #theloginform,
    #content {
    display: block !important;
  }

  /* hide the link to view saved logins */
  #theloginform #usernamegroup #hint_back_chooser {
    display: none !important;
  }

  /* hide header text on left div */
  #left #header {
    display: none !important;
  }

  /* hide 'login with different identity' text */
  #use_new_identity_div {
    display: none !important;
  }

  /* hide clock icon and avatar in the display list */
  :is(#idlist, #editlist) img.thumbnail, :is(#idlist, #editlist) img.activity {
    display: none !important;
  }

  /* correct spacing and increase font size */
  :is(#idlist, #editlist) span {
    position: static;
    padding-left: 5px;
    font-size: 13px;
  }

  /* reduce padding of logins */
  #idlist a {
    padding: 8px !important;
  }
`);

waitForElement("#main").then(() => {
  moveLoginsToRight();
  moveSavedLoginsEditorToRight();
});

waitForElement("#idlist").then(() => {
  setTimeout(sortSavedUsernames, 500);
});

// Clones left div elements and moves them to the right side of the page
function moveLoginsToRight() {
  const wrap = document.getElementById("wrap")?.cloneNode();
  const main = document.getElementById("main")?.cloneNode();
  const wrapper = document.getElementById("wrapper")?.cloneNode();
  const content = document.getElementById("content")?.cloneNode();
  const headerRight = document.getElementById("header")?.cloneNode();

  if (headerRight) {
    headerRight.innerHTML = "Choose a Username";
  }

  const loginSelector = document.getElementById("chooser");
  const rightDiv = document.getElementById("right");

  if (wrap && main && wrapper && content && headerRight && loginSelector) {
    wrap.appendChild(main);
    main.appendChild(wrapper);
    wrapper.appendChild(headerRight);
    wrapper.appendChild(content);
    content.appendChild(loginSelector);
  }

  if (rightDiv && wrap) {
    rightDiv.appendChild(wrap);
  }
}

// Moves the div for editing saved logins to the right side of the page
function moveSavedLoginsEditorToRight() {
  const savedLoginEditor = document.getElementById("manager");
  const rightContainer = document.querySelector("#right #content");

  if (savedLoginEditor && rightContainer) {
    const savedLoginEditorClone = savedLoginEditor.cloneNode(true);

    rightContainer.appendChild(savedLoginEditorClone);
    savedLoginEditor.remove();
  }
}

// Sorts the container elements alphabetically
function sortSavedUsernames() {
  const container = document.getElementById("idlist");

  if (container) {
    const logins = container.children;

    const sortedLogins = Array.from(logins);

    // no saved logins
    if (sortedLogins.length <= 1) {
      const parentContainer = document.querySelector("div#right #content");
      parentContainer.innerHTML = `
      <div>
        <h2 style="text-align: center">Salesforce Improved</h2>
        <p style="text-align: center; margin-bottom: 0.83em">No saved logins to display.</p>
      </div>
      `;
      return;
    }

    const loginName = (login) => {
      return login.firstElementChild?.lastChild?.textContent ?? "";
    };

    sortedLogins.sort((a, b) => {
      return loginName(a).localeCompare(loginName(b));
    });

    for (let i = 0; i < sortedLogins.length; i++) {
      container.appendChild(sortedLogins[i]);
    }
  }
}
