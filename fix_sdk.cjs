const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(/const ai = new GoogleGenAI\(\{[\s\S]*?\}\)/, 'const ai = new GoogleGenAI({ apiKey })');
content = content.replace('  apiKey,\n  httpOptions: {\n    headers: {\n      "User-Agent": "aistudio-build",\n    },\n  },\n})', '');
fs.writeFileSync('server.ts', content);
