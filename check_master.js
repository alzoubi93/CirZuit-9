async function checkMasterItems() {
  const url = `https://gitlab.com/api/v4/projects/kicad%2Flibraries%2Fkicad-symbols/repository/tree?ref=master&per_page=100&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("Items in master:", data.slice(0, 15));
}
checkMasterItems();
