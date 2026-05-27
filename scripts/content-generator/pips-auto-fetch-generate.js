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

async function fetchPipsData(dateString) {
    // Official NYT Pips API endpoint format
    const url = `https://www.nytimes.com/svc/pips/v1/${dateString}.json`; 
    console.log(`Fetching from NYT Pips API: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Pips data: ${response.statusText}. Please verify the API endpoint.`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching Pips data:", error);
        return null;
    }
}

async function generatePipsContent(rawData, dateString) {
    console.log("Generating Pips content via Gemini...");

    // Dump the raw JSON into the prompt for the AI to parse
    const promptData = `Date: ${dateString}\nRaw Data:\n${JSON.stringify(rawData, null, 2)}`;

    const systemPrompt = `Act as a jaded but helpful gaming editor. Your job is to take the raw answers for the daily NYT Pips domino puzzle and convert them into our custom "Progressive Hint" HTML structure for our static site.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

### The Persona & Anti-AI Guidelines (CRITICAL)
- Tone: Extremely direct, slightly cynical about the puzzle setter's difficulty choices, but very practical. Write like a real human who is tired of standard AI fluff.
- BANNED WORDS (NEVER use these): delve, tapestry, explore, furthermore, moreover, in conclusion, testament, crucial, vital, beacon, embark, navigate, multifaceted, realm, dive in, let's look at.
- BANNED PHRASES: Do not use robotic transitions ("Firstly", "Secondly") or generic intros/outros ("Welcome to today's puzzle", "Get ready", "Good luck!"). Skip the fluff and just give the hints directly.
- Humanization: Be concise. Use short sentences. Sometimes sound a bit bored or annoyed by the puzzle's logic.

### The Stages (CRITICAL SEO REQUIREMENT)
You must generate exactly 2-3 progressive hints for the Pips domino layout. 
Write 2-3 natural-sounding, fluff-free sentences for each hint.
You must output a JSON array of the hints as well, to be placed in the YAML frontmatter.

### OUTPUT FORMAT
You MUST output exactly the following structure:
1. The YAML frontmatter containing the 'hints' array.
2. The HTML body containing the <details> blocks for the hints.

Example Output:
---
title: "NYT Pips Hints Today"
date: ${dateString}
game: "pips"
hints:
  - level: "Easy Starting Coordinate"
    description: "Start at Top-Left (Row 1, Col 1). It's a [3, 4] domino."
  - level: "Medium Coordinate"
    description: "Look at the center. The double-six [6, 6] goes horizontally."
---

Stuck on today's Pips domino layout? Use our gradual hints to save your streak.

<div class="bg-red-900/40 border border-red-500/50 p-4 rounded-md mb-6 text-red-200">
    <strong>Spoilers Ahead!</strong> Reveal the dominos below at your own risk.
</div>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-blue-300">
        <span>Easy Starting Coordinate</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        Start at Top-Left (Row 1, Col 1). It's a [3, 4] domino.
    </div>
</details>

<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-orange-300">
        <span>Medium Coordinate</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        Look at the center. The double-six [6, 6] goes horizontally.
    </div>
</details>

IMPORTANT INSTRUCTION: Generate ONLY the YAML Frontmatter and the HTML body content based on the raw data. Do not add any extra explanations.`;

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

        // 1. Fetch Data
        const rawData = await fetchPipsData(dateString);
        if (!rawData) {
            console.error("No data fetched for Pips. Aborting. Did you set the correct API URL?");
            process.exit(1);
        }

        // 2. Generate Content via AI
        const fullContent = await generatePipsContent(rawData, dateString);

        // 3. Write to File
        const outPath = path.resolve(__dirname, `../../src/content/pips/${dateString}.md`);
        fs.writeFileSync(outPath, fullContent, 'utf-8');
        
        console.log(`✅ Success! Created Pips file at: ${outPath}`);
    } catch (error) {
        console.error("❌ Pips Automation Failed:", error);
        process.exit(1);
    }
}

main();
