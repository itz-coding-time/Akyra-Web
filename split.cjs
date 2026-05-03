const fs = require('fs');
const path = require('path');

const repoFile = path.join(__dirname, 'src', 'lib', 'repository.ts');
const targetDir = path.join(__dirname, 'src', 'lib', 'repository');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

const content = fs.readFileSync(repoFile, 'utf8');
const lines = content.split(/\r?\n/);

let headerLines = [];
let currentChunkLines = [];
let currentDomain = null;
let barrelExports = [];

function formatFileName(name) {
  let clean = name.replace(/\([^)]+\)/g, '').trim();
  clean = clean.replace(/[^a-zA-Z0-9 ]/g, '');
  let parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return 'misc';
  let first = parts[0].toLowerCase();
  let rest = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  return first + rest;
}

let lineIndex = 0;

for (; lineIndex < lines.length; lineIndex++) {
  const line = lines[lineIndex];
  // Match `// ` followed by non-alphanumeric (like --), space, Title, space, non-alphanumeric.
  // Example: // -- Profiles ----------
  if (line.match(/^\/\/\s+[^\w\s]+\s+[a-zA-Z0-9\s()&:-]+\s+[^\w\s]+/)) {
    break; 
  }
  headerLines.push(line);
}

while (headerLines.length > 0 && headerLines[headerLines.length - 1].trim() === '') {
  headerLines.pop();
}

function flushChunk() {
  if (currentDomain && currentChunkLines.length > 0) {
    const fileName = formatFileName(currentDomain) + '.ts';
    const filePath = path.join(targetDir, fileName);
    
    let imports = headerLines.join('\n');
    let code = currentChunkLines.join('\n');
    
    // Some lines inside chunks might have duplicate imports if we aren't careful, 
    // but repository.ts has them all at the top.
    const fileContent = imports + '\n\n' + code + '\n';
    
    fs.writeFileSync(filePath, fileContent);
    barrelExports.push(`export * from "./repository/${fileName.replace('.ts', '')}"`);
  }
}

for (; lineIndex < lines.length; lineIndex++) {
  const line = lines[lineIndex];
  
  const match = line.match(/^\/\/\s+[^\w\s]+\s+([a-zA-Z0-9\s()&:-]+?)\s+[^\w\s]+.*$/);
  
  if (match) {
    flushChunk();
    currentDomain = match[1].trim();
    currentChunkLines = [line];
  } else {
    if (currentDomain) {
      currentChunkLines.push(line);
    } else {
      headerLines.push(line);
    }
  }
}

flushChunk();

fs.writeFileSync(repoFile, barrelExports.join('\n') + '\n');
console.log('Split successful. Generated files:', barrelExports.length);
