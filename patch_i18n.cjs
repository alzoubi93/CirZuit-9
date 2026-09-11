const fs = require('fs');
let code = fs.readFileSync('src/i18n/index.tsx', 'utf-8');

const enJson = `
    connectorGen: {
      title: "Connector Generator",
      type: "Type / Gender",
      male: "Male Pin Header",
      female: "Female Socket",
      shrouded: "Shrouded / Box Header",
      dip: "DIP Socket",
      rows: "Rows",
      singleRow: "Single Row (1xN)",
      doubleRow: "Double Row (2xN)",
      pinsPerRow: "Pins Per Row",
      pitch: "Pitch",
      pitch254: "2.54mm (100mil)",
      pitch200: "2.00mm",
      pitch127: "1.27mm (50mil)",
      orientation: "Orientation",
      straight: "Straight / Vertical",
      rightAngle: "Right-Angle (90°)",
      prefix: "Prefix",
      generate: "Generate",
      addText: "Add Text"
    },
    symbols: {`;

const arJson = `
    connectorGen: {
      title: "مُوَلِّد المقابس",
      type: "النوع / الجنس",
      male: "رأس دبابيس ذكر (Male)",
      female: "مقبس أنثى (Female)",
      shrouded: "مقبس صندوقي (Shrouded)",
      dip: "مقبس (DIP)",
      rows: "الصفوف",
      singleRow: "صف واحد (1xN)",
      doubleRow: "صف مزدوج (2xN)",
      pinsPerRow: "الدبابيس لكل صف",
      pitch: "المسافة بين الدبابيس (Pitch)",
      pitch254: "2.54 مم (100mil)",
      pitch200: "2.00 مم",
      pitch127: "1.27 مم (50mil)",
      orientation: "الاتجاه",
      straight: "مستقيم / عمودي",
      rightAngle: "زاوية قائمة (90°)",
      prefix: "البادئة",
      generate: "توليد",
      addText: "إضافة نص"
    },
    symbols: {`;

code = code.replace(/    symbols: \{/g, (match, offset) => {
  if (offset < 5000) {
    return enJson;
  }
  return arJson;
});

fs.writeFileSync('src/i18n/index.tsx', code);
