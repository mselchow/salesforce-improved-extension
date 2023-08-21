# Salesforce Improved

Salesforce Improved is a Chrome browser extension designed to improve the general UI/UX of various Salesforce pages, as well as fix common annoyances on the platform.

## Features

The following UI/UX adjustment are included / in progress:

- [ ] **Extension Options**
  - [ ] Allow user ability to toggle individual UI adjustments
- [ ] **Cross-Browser**
  - [ ] Firefox version of extension
- [x] **General**
  - [x] Default any Salesforce pop-ups to be minimized
  - [x] Adds quick links to Setup from any front-end Salesforce page
- [x] **Login Page**
  - [x] Hide Salesforce ads on right half of page
  - [x] Adjust page padding/margin for maximize use of space
  - [x] Always show login form on the left
  - [x] Display saved/recent logins on the right
    - [x] Display more logins and reduce padding
    - [x] Clean up display of logins
    - [x] Alphabetize logins
- [x] **Lightning Pages**
  - [x] Hide walkthrough tips pop-ups
  - [x] Hide AppExchange link
  - [x] Hide focus-stealing pop-ups (tips, page optimizer, etc.)
- [x] **Flow**
  - [x] Increase modal widths to improve visibility of dropdown elements
  - [x] Allow record selection dropdown for debugging to overflow container
  - [x] Increase width of left sidebar to improve variable name visibility
  - [x] Increase minimum height of multi-line text boxes in edit windows
  - [x] Change default font of multi-line formula field text boxes to monospace font
- [ ] **Setup**
  - [x] Allow managed packages to be sorted by column / default to alphabetically
  - [ ] Allow org-wide sharing table to be sorted / default to alphabetically
- [ ] **Reports**
  - [ ] Improve field drag/drop functionality (if possible)
- [ ] **Dashboards**
  - [ ] Improve component drag/drop functionality (if possible)

## Building

1.  Clone the repository
2.  Run `npm install` in the directory
3.  Create distributable files using `npm run build` or `npm run dev`
4.  Open `chrome://extensions/`
5.  Enable Developer Mode
6.  Click `Load Unpacked`
7.  Select the `dist` folder (if you ran `build`) or the `src` folder (if you ran `dev`)

## Credits

[Emoji icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/emoji)
