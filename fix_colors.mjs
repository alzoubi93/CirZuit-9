import fs from 'fs';
import path from 'path';

const dir = 'src/components/editor/footprint-families';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /<label className="text-\[10px\] font-semibold text-slate-300 flex items-center justify-between mb-1\.5">\s*<span>Quick Standard Packages<\/span>\s*<\/label>/g,
    `<div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span>Quick Standard Packages</span>
              </span>
            </div>`
  );
  fs.writeFileSync(file, content);
});
console.log("Done");
