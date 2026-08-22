import { GoogleGenAI } from "@google/genai";
console.log("using key length:", process.env.GEMINI_API_KEY.length);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "hello"
}).then(res => console.log(res.text))
  .catch(err => console.error("ERR:", err.message));
