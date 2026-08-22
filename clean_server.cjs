const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('app.get("/api/debug/val", (req, res) => res.json({ val: process.env.GEMINI_API_KEY }));\n  ', '');
fs.writeFileSync('server.ts', content);
