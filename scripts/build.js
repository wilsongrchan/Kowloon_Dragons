// node scripts/build.js  ->  dist/index.html (single file, engine inlined)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8')
  .replace("if (typeof module !== 'undefined') module.exports", 'if (false) module.exports');
const html = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8').replace('/*__ENGINE__*/', engine);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('built dist/index.html', html.length, 'bytes');
