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

async function fetchStrandsData(dateString) {
    const url = `https://www.nytimes.com/svc/strands/v2/${dateString}.json`; 
    console.log(`Fetching from NYT Strands API: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Strands data: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching Strands data:", error);
        return null;
    }
}

async function generateStrandsContent(rawData, dateString) {
    console.log("Generating Strands content via Gemini...");

    const theme = rawData.theme || "UNKNOWN";
    const spangram = rawData.spangram || "UNKNOWN";
    const themeWords = rawData.themeWords ? rawData.themeWords.join(', ') : "UNKNOWN";

    const promptData = `Date: ${dateString}\nTheme (Clue): ${theme}\nSpangram: ${spangram}\nTheme Words: ${themeWords}`;

    const systemPrompt = `Act as a jaded but helpful gaming editor. Your job is to take the raw answers for the daily NYT Strands puzzle and convert them into our custom "Progressive Hint" HTML structure for our static site.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

### The Persona & Anti-AI Guidelines (CRITICAL)
- Tone: Extremely direct, slightly cynical but very practical. Write like a real human who is tired of standard AI fluff.
- BANNED WORDS (NEVER use these): delve, tapestry, explore, furthermore, moreover, in conclusion, testament, crucial, vital, beacon, embark, navigate, multifaceted, realm, dive in, let's look at.
- BANNED PHRASES: Do not use robotic transitions ("Firstly", "Secondly") or generic intros/outros.
- Humanization: Be concise. Use short sentences. 

### The Stages (CRITICAL SEO REQUIREMENT)
You must generate exactly 3 progressive hints for the Strands puzzle.
Write 2-3 natural-sounding, fluff-free sentences for each hint.
You must output a JSON array of the hints as well, to be placed in the YAML frontmatter.

- Hint 1 (Theme Explanation): Explain what the daily Theme (Clue) actually means in plain English without giving away the exact words.
- Hint 2 (Spangram Hint): Give a strong hint for the Spangram (the word that connects two sides of the board), including its starting letter and meaning.
- Hint 3 (One Easy Word): Give a hint for one of the easiest Theme Words to help them get started.

### SEO Keyword Injection (MANDATORY)
You MUST naturally weave the following exact phrases into your conversational hints (especially in the intro paragraph or first hint):
- "NYT Strands hints today"
- "Strands hints today"
- "tips for Strands today"
- "Strands today"

### OUTPUT FORMAT
You MUST output exactly the following structure:
1. The YAML frontmatter containing the 'hints' array.
2. The HTML body containing the <details> blocks for the hints.

Example Output:
---
title: "NYT Strands Hints for ${dateString}"
date: ${dateString}
game: "strands"
hints:
  - level: "Theme Explanation"
    description: "Today's theme is all about..."
  - level: "Spangram Hint"
    description: "The spangram starts with..."
  - level: "Starting Word"
    description: "Look for..."
---

If you're stuck and need NYT Strands hints today, you've come to the right place. Here are progressive tips to help you solve the board.

<div class="bg-red-900/40 border border-red-500/50 p-4 rounded-md mb-6 text-red-200">
    <strong>Spoilers Ahead!</strong> Reveal the hints below at your own risk.
</div>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-blue-300">
        <span>1. Theme Explanation</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [HINT 1]
    </div>
</details>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-orange-300">
        <span>2. Spangram Hint</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [HINT 2]
    </div>
</details>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-red-400">
        <span>3. One Easy Word</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [HINT 3]
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

        const rawData = await fetchStrandsData(dateString);
        if (!rawData) {
            console.error("No data fetched for Strands. Aborting.");
            process.exit(1);
        }

        const fullContent = await generateStrandsContent(rawData, dateString);
        
        // Ensure directory exists
        const dirPath = path.resolve(__dirname, '../../src/content/strands');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const outPath = path.resolve(dirPath, `${dateString}.md`);
        fs.writeFileSync(outPath, fullContent, 'utf-8');
        
        console.log(`✅ Success! Created Strands file at: ${outPath}`);
    } catch (error) {
        console.error("❌ Strands Automation Failed:", error);
        process.exit(1);
    }
}

main();
