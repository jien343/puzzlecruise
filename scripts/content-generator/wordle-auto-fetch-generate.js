import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchWordleData(dateString) {
    const url = `https://www.nytimes.com/svc/wordle/v2/${dateString}.json`; 
    console.log(`Fetching from NYT Wordle API: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Wordle data: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching Wordle data:", error);
        return null;
    }
}

async function generateWordleContent(rawData, dateString) {
    console.log("Generating Wordle content via Gemini...");

    const solution = rawData.solution || "UNKNOWN";
    const promptData = `Date: ${dateString}\nWordle Solution: ${solution.toUpperCase()}`;

    const systemPrompt = `Act as a jaded but helpful gaming editor. Your job is to take the raw answer for the daily NYT Wordle puzzle and convert it into our custom "Progressive Hint" HTML structure for our static site.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

### The Persona & Anti-AI Guidelines (CRITICAL)
- Tone: Extremely direct, slightly cynical but very practical. Write like a real human who is tired of standard AI fluff.
- BANNED WORDS (NEVER use these): delve, tapestry, explore, furthermore, moreover, in conclusion, testament, crucial, vital, beacon, embark, navigate, multifaceted, realm, dive in, let's look at.
- BANNED PHRASES: Do not use robotic transitions ("Firstly", "Secondly") or generic intros/outros ("Welcome to today's puzzle", "Get ready", "Good luck!").
- Humanization: Be concise. Use short sentences. 

### SEO Keyword Injection (MANDATORY BUT MUST BE NATURAL)
You should try to weave 1 or 2 (NOT ALL) of the following phrases into your conversational hints:
- "NYT Wordle hints today"
- "Wordle solver"
- "Wordle answer today"
- "today's Wordle solution"
WARNING: DO NOT keyword stuff. Google penalizes robotic keyword stuffing. Pick a maximum of 2 phrases and spread them out organically so they sound like natural gamer chatter (e.g. "If you're looking for the full Wordle answer today, this first hint is..."). If it feels forced, leave it out.

### The Stages (CRITICAL SEO REQUIREMENT)
You must generate exactly 3 progressive hints for the Wordle solution.
Write 2-3 natural-sounding, fluff-free sentences for each hint.
You must output a JSON array of the hints as well, to be placed in the YAML frontmatter.

- Hint 1 (Vowels & Starting Letter): How many vowels are there? What's a good starting word?
- Hint 2 (Meaning / Definition): What does the word mean? Use a subtle synonym.
- Hint 3 (The Answer): Reveal the exact word.

### SEO Keyword Injection (MANDATORY)
You MUST naturally weave the following exact phrases into your conversational hints (especially in the intro paragraph or first hint):
- "NYT Wordle hints today"
- "Wordle hints today"
- "tips for Wordle today"
- "Wordle today"

### OUTPUT FORMAT
You MUST output exactly the following structure:
1. The YAML frontmatter containing the 'hints' array.
2. The HTML body containing the <details> blocks for the hints.

Example Output:
---
title: "NYT Wordle Hints for ${dateString}"
date: ${dateString}
game: "wordle"
hints:
  - level: "Vowels & Start"
    description: "There are two vowels today..."
  - level: "Meaning Hint"
    description: "Think about..."
---

Struggling with Wordle today? If you're looking for Wordle hints today, here is a quick breakdown to save your streak.

<div class="bg-red-900/40 border border-red-500/50 p-4 rounded-md mb-6 text-red-200">
    <strong>Spoilers Ahead!</strong> Reveal the hints below at your own risk.
</div>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-blue-300">
        <span>1. Vowels & Start</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [HINT 1]
    </div>
</details>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-orange-300">
        <span>2. Meaning Hint</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [HINT 2]
    </div>
</details>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-red-400">
        <span>🚨 The Answer</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        The answer is <strong>[SOLUTION]</strong>.
    </div>
</details>

IMPORTANT INSTRUCTION: Generate ONLY the YAML Frontmatter and the HTML body content. Do not add any extra explanations.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent({
        contents: [
            {
                role: "user",
                parts: [{ text: `SYSTEM DIRECTIVES:\n${systemPrompt}\n\nUSER REQUEST:\nHere is the raw data:\n${promptData}` }]
            }
        ],
        generationConfig: {
            temperature: 0.7,
        }
    });

    let output = result.response.text();
    output = output.replace(/^```html\n/, '').replace(/^```markdown\n/, '').replace(/^```\n/, '').replace(/```$/, '');
    return output;
}

async function main() {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables.");
        }

        let dateString;
        if (process.argv[2]) {
            dateString = process.argv[2];
        } else {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            dateString = date.toISOString().split('T')[0];
        }

        const rawData = await fetchWordleData(dateString);
        if (!rawData) {
            console.error("No data fetched for Wordle. Aborting.");
            process.exit(1);
        }

        const fullContent = await generateWordleContent(rawData, dateString);
        
        // Ensure directory exists
        const dirPath = path.resolve(__dirname, '../../src/content/wordle');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const outPath = path.resolve(dirPath, `${dateString}.md`);
        fs.writeFileSync(outPath, fullContent, 'utf-8');
        
        console.log(`✅ Success! Created Wordle file at: ${outPath}`);
    } catch (error) {
        console.error("❌ Wordle Automation Failed:", error);
        process.exit(1);
    }
}

main();
