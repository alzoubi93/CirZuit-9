const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ConnectorGeneratorModal.tsx', 'utf-8');

code = code.replace(
  'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";',
  ''
);

const selectClass = 'className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 col-span-3"';

code = code.replace(
  /<Select value=\{gender\} onValueChange=\{\(v: any\) => setGender\(v\)\}>\s*<SelectTrigger className="col-span-3">\s*<SelectValue \/>\s*<\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="MALE">Male Pin Header<\/SelectItem>\s*<SelectItem value="FEMALE">Female Socket<\/SelectItem>\s*<SelectItem value="SHROUDED">Shrouded \/ Box Header<\/SelectItem>\s*<SelectItem value="DIP">DIP Socket<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>/g,
  `<select value={gender} onChange={(e: any) => setGender(e.target.value)} ${selectClass}>
                <option value="MALE">Male Pin Header</option>
                <option value="FEMALE">Female Socket</option>
                <option value="SHROUDED">Shrouded / Box Header</option>
                <option value="DIP">DIP Socket</option>
              </select>`
);

code = code.replace(
  /<Select value=\{rows\.toString\(\)\} onValueChange=\{\(v\) => setRows\(parseInt\(v, 10\)\)\}>\s*<SelectTrigger className="col-span-3">\s*<SelectValue \/>\s*<\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="1">Single Row \(1xN\)<\/SelectItem>\s*<SelectItem value="2">Double Row \(2xN\)<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>/g,
  `<select value={rows.toString()} onChange={(e) => setRows(parseInt(e.target.value, 10))} ${selectClass}>
                <option value="1">Single Row (1xN)</option>
                <option value="2">Double Row (2xN)</option>
              </select>`
);

code = code.replace(
  /<Select value=\{pitch\.toString\(\)\} onValueChange=\{\(v\) => setPitch\(parseFloat\(v\)\)\}>\s*<SelectTrigger className="col-span-3">\s*<SelectValue \/>\s*<\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="2\.54">2\.54mm \(100mil\)<\/SelectItem>\s*<SelectItem value="2">2\.00mm<\/SelectItem>\s*<SelectItem value="1\.27">1\.27mm \(50mil\)<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>/g,
  `<select value={pitch.toString()} onChange={(e) => setPitch(parseFloat(e.target.value))} ${selectClass}>
                <option value="2.54">2.54mm (100mil)</option>
                <option value="2">2.00mm</option>
                <option value="1.27">1.27mm (50mil)</option>
              </select>`
);

code = code.replace(
  /<Select value=\{orientation\} onValueChange=\{\(v: any\) => setOrientation\(v\)\}>\s*<SelectTrigger className="col-span-3">\s*<SelectValue \/>\s*<\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="STRAIGHT">Straight \/ Vertical<\/SelectItem>\s*<SelectItem value="RIGHT_ANGLE">Right-Angle \(90°\)<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>/g,
  `<select value={orientation} onChange={(e: any) => setOrientation(e.target.value)} ${selectClass}>
                <option value="STRAIGHT">Straight / Vertical</option>
                <option value="RIGHT_ANGLE">Right-Angle (90°)</option>
              </select>`
);

fs.writeFileSync('src/components/editor/ConnectorGeneratorModal.tsx', code);
