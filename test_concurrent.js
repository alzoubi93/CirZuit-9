// mock KICAD_GITLAB_RAW etc
const KICAD_GITLAB_RAW = "https://gitlab.com/kicad/libraries/kicad-symbols/-/raw";
const KICAD_GITLAB_API = `https://gitlab.com/api/v4/projects/kicad%2Flibraries%2Fkicad-symbols`;

async function attemptUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try { 
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`GitLab raw HTTP ${res.status}`);
    const text = await res.text();
    if (text.includes("kicad_symbol_lib") && text.includes("(symbol ")) {
      return text;
    }
    throw new Error("Invalid");
  } finally { 
    clearTimeout(timer); 
  }
}

async function testLib(cleanName) {
  const compactRefs = ["9.0.9.1", "9.0.9", "9.0.8", "9.0.7", "8.0.9", "8.0.0", "7.0.11"];
  const name = `${cleanName}.kicad_sym`;
  const promises = [];
  for (const ref of compactRefs) {
    promises.push(attemptUrl(`${KICAD_GITLAB_RAW}/${encodeURIComponent(ref)}/${encodeURIComponent(name)}`));
    promises.push(attemptUrl(`${KICAD_GITLAB_API}/repository/files/${encodeURIComponent(name)}/raw?ref=${encodeURIComponent(ref)}`));
  }
  const start = Date.now();
  try {
    await Promise.any(promises);
    console.log(cleanName, "success in", Date.now() - start, "ms");
  } catch (e) {
    console.log(cleanName, "failed in", Date.now() - start, "ms");
  }
}

async function run() {
  await testLib("MCU_Espressif");
  await testLib("Does_Not_Exist");
}
run();
