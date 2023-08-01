import addGlobalStyle from "../lib/addGlobalStyle";

addGlobalStyle(`
  /* hide description rows because they mess up our sorting */
  tr#null_description {
    display: none !important;
  }

  /* underline header row links */
  table.list tr.headerRow th a {
    text-decoration: underline !important;
  }
`);

const table = document.querySelector("table.list");

addSortableClass(table);
replaceTableHeaderWithTableData();
makeSortable();
sortRows(table, 2);

// gets all table data points that are in <th> tags and replaces them with <td> tags
function replaceTableHeaderWithTableData() {
  const parentRows = document.querySelectorAll("table.list tr.dataRow");

  parentRows.forEach((parent) => {
    const thElement = parent.querySelector("th[scope='row']");

    if (thElement) {
      const newElement = document.createElement("td");
      newElement.classList.add("dataCell");

      thElement.childNodes?.forEach((child) => {
        if (child) {
          let childClone = child.cloneNode(true);
          newElement.appendChild(childClone);
        }
      });

      parent.replaceChild(newElement, thElement);
    }
  });
}

// find table and set 'sortable' class
function addSortableClass(element) {
  element?.classList?.add("sortable");
}

// add link to be able to sort table
function makeSortable() {
  const tables = document.querySelectorAll("table.sortable");
  tables.forEach((table) => {
    const thead = table.querySelector("tr.headerRow");
    if (thead) {
      const headers = thead.querySelectorAll("th");
      headers.forEach((header) => {
        header.innerHTML = `<a href="#">${header.innerHTML}</a>`;
      });

      thead.addEventListener("click", sortTableFunction(table));
    } else {
      console.log(
        "Salesforce Improved Extension: No header row found in table. Unable to sort."
      );
    }
  });
}

// Intercept default click event and call the function to sort each row
function sortTableFunction(table) {
  return (event) => {
    if (event.target.tagName.toLowerCase() == "a") {
      sortRows(table, siblingIndex(event.target.parentNode));
      event.preventDefault();
    }
  };
}

// function to sort table rows called sortRows
function sortRows(table, columnIndex) {
  const rows = table.querySelectorAll("tbody tr");
  const sel2 = "td:nth-child(" + (columnIndex + 1) + ")";
  let value,
    values = [],
    node;

  rows.forEach((row) => {
    node = row.querySelector(sel2);
    if (node) {
      value = node.innerText;
      values.push({ value: value, row: row });
    }
  });

  values.sort((a, b) => {
    return a.value.localeCompare(b.value);
  });

  values.forEach((item) => {
    table.querySelector("tbody").appendChild(item.row);
  });
}

/**
 * Get the index of a node relative to its siblings — the first (eldest) sibling
 * has index 0, the next index 1, etc.
 */
function siblingIndex(node) {
  var count = 0;

  while ((node = node.previousElementSibling)) {
    count++;
  }

  return count;
}
