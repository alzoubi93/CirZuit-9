async function checkGitLabFiles() {
  let page = 1;
  let allFiles = [];
  while (true) {
    const url = `https://gitlab.com/api/v4/projects/kicad%2Flibraries%2Fkicad-symbols/repository/tree?ref=master&per_page=100&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allFiles.push(...data);
    if (data.length < 100) break;
    page++;
  }
  const symFiles = allFiles.filter(f => f.name.endsWith('.kicad_sym'));
  console.log(`Total items in master: ${allFiles.length}`);
  console.log(`Total .kicad_sym files in master: ${symFiles.length}`);
  console.log('Sample sym file names:', symFiles.slice(0, 10).map(f => f.name));

  // Let's also check tags like 9.0.9.1 or default branch
  let pageTag = 1;
  let allTagFiles = [];
  while (true) {
    const url = `https://gitlab.com/api/v4/projects/kicad%2Flibraries%2Fkicad-symbols/repository/tree?ref=9.0.9.1&per_page=100&page=${pageTag}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allTagFiles.push(...data);
    if (data.length < 100) break;
    pageTag++;
  }
  const symTagFiles = allTagFiles.filter(f => f.name.endsWith('.kicad_sym'));
  console.log(`Total .kicad_sym files in tag 9.0.9.1: ${symTagFiles.length}`);
}

checkGitLabFiles();
