import fs from 'fs';
import path from 'path';

const dirs = ['src/components/editor', 'src/components/editor/footprint-families'];

dirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f));
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace `-- {lang === "ar" ? "..." : "..."} --` with `-- ... --`
    const regex = /--\s*\{lang === "ar" \? "[^"]+" : "([^"]+)"\}\s*--/g;
    
    if (regex.test(content)) {
      content = content.replace(regex, '-- $1 --');
      fs.writeFileSync(file, content);
      console.log(`Updated ${file}`);
    }
  });
});
console.log("Done");
