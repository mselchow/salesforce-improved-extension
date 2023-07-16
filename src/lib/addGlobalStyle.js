// Adds global CSS to the header
export default function addGlobalStyle(css) {
  const head = document.getElementsByTagName("head")[0];

  if (!head) {
    return;
  }

  let style = document.createElement("style");
  style.setAttribute("type", "text/css");
  style.innerHTML = css;
  head.appendChild(style);
}
