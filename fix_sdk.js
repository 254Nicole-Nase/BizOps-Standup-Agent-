const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(/const ai = new GoogleGenAI\(\{[\s\S]*?\}\)/, 'const ai = new GoogleGenAI({ apiKey })');
fs.writeFileSync('server.ts', content);
