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

async function fetchNYTConnections(dateString) {
    // Unofficial NYT API endpoint format
    const url = `https://www.nytimes.com/svc/connections/v2/${dateString}.json`;
    console.log(`Fetching from NYT API: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch NYT data: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching NYT data:", error);
        return null;
    }
}

async function generateAIContent(rawData, dateString) {
    console.log("Generating content via OpenAI...");

    // Map NYT JSON to a readable format for the prompt
    // NYT categories usually contain: cards (words), category (theme), level (0-3 for colors)
    let promptData = `Date: ${dateString}\n`;
    if (rawData && rawData.categories) {
        const colors = ['Yellow', 'Green', 'Blue', 'Purple'];
        rawData.categories.forEach((cat, index) => {
            const words = cat.cards.map(c => c.content).join(', ');
            const color = colors[index];
            promptData += `${color}: [${words}] - ${cat.title}\n`;
        });
    } else {
        throw new Error("Invalid raw data structure from NYT");
    }

    const systemPrompt = `Act as a jaded but helpful gaming editor. Your job is to take the raw answers for the daily NYT Connections puzzle and convert them into our custom "Three-Stage Progressive Hint" HTML structure for our static site.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

### The Persona & Anti-AI Guidelines (CRITICAL)
- Tone: Extremely direct, slightly cynical about the puzzle setter's difficulty choices, but very practical. Write like a real human who is tired of standard AI fluff.
- BANNED WORDS (NEVER use these): delve, tapestry, explore, furthermore, moreover, in conclusion, testament, crucial, vital, beacon, embark, navigate, multifaceted, realm, dive in, let's look at.
- BANNED PHRASES: Do not use robotic transitions ("Firstly", "Secondly") or generic intros/outros ("Welcome to today's puzzle", "Get ready", "Good luck!"). Skip the fluff and just give the hints directly like you're texting a friend.
- Humanization: Be concise. Use short sentences. Sometimes sound a bit bored or annoyed by the puzzle's logic.
- Goal: Do not spoil the puzzle immediately. Provide hints in 3 exact stages for EACH OF THE 4 COLORS (Yellow, Green, Blue, Purple). You MUST output all 4 colors.

### The Stages (CRITICAL SEO REQUIREMENT)
To ensure we have enough engaging text for SEO, write 3-4 natural-sounding, fluff-free sentences for EACH of the Stage 1 and Stage 2 hints. 

- Stage 1 (Category Hint): Give a vague but practical hint about what the category represents. Talk about the theme directly.
- Stage 2 (Synonym/Example Hint): Give the starting letter of one word, or a strong synonym for one of the words, wrapping it in straightforward commentary.
- Stage 3 (Final Answer): The exact category name and the 4 words.

### SEO Keyword Injection (MANDATORY BUT MUST BE NATURAL)
You should try to weave 1 or 2 (NOT ALL) of the following exact phrases into your conversational hints (especially in the Stage 1 hints):
- "NYT Connections hints today"
- "Connections solver"
- "Connections answer today"
- "today's Connections solution"
WARNING: DO NOT keyword stuff. Google penalizes robotic keyword stuffing. Pick a maximum of 2 phrases and spread them out across the different color groups organically so they sound like natural gamer chatter (e.g. "If you're looking for the full Connections answer today, this yellow group is basically..."). If it feels forced, leave it out.

Use EXACTLY this HTML format for EACH color (change background colors appropriately: Yellow: bg-yellow-400, Green: bg-green-400, Blue: bg-blue-400, Purple: bg-purple-400):

### 🟨 Yellow Group
<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-yellow-400">
        <span>1. Category Hint (Safest)</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        [INSERT CATEGORY HINT HERE]
    </div>
</details>
<details class="w-full mb-3 group cursor-pointer rounded-md overflow-hidden border border-gray-800 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:brightness-110 flex justify-between items-center text-gray-900 bg-yellow-400/80">
        <span>2. Synonym / Example Hint</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
         [INSERT SYNONYM HINT HERE]
    </div>
</details>
<details class="w-full mb-8 group cursor-pointer rounded-md overflow-hidden border border-red-900 bg-[#111827]">
    <summary class="px-4 py-3 font-semibold select-none transition-colors hover:bg-red-900/50 flex justify-between items-center text-red-400">
        <span>🚨 Final Answer (Spoiler!)</span>
    </summary>
    <div class="px-4 py-4 text-gray-300 leading-relaxed bg-[#111827]">
        <strong>Category:</strong> [CATEGORY NAME]<br/>
        <strong>Words:</strong> [WORDS]
    </div>
</details>

IMPORTANT INSTRUCTION: Generate ONLY the YAML Frontmatter (if needed) and the HTML body content. Do not add any extra explanations, intros, or outros outside the HTML blocks.`;

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
    // Clean up any markdown block quotes if Gemini returns them
    output = output.replace(/^```html\n/, '').replace(/^```\n/, '').replace(/```$/, '');
    return output;
}

async function main() {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables.");
        }

        // Get tomorrow's date by default, or use arg
        let dateString;
        if (process.argv[2]) {
            dateString = process.argv[2];
        } else {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            dateString = date.toISOString().split('T')[0];
        }

        // 1. Fetch Data
        const rawData = await fetchNYTConnections(dateString);
        if (!rawData) {
            console.error("No data fetched. Aborting.");
            process.exit(1);
        }

        // 2. Generate Content via AI
        const htmlContent = await generateAIContent(rawData, dateString);

        // Extract all 16 words and shuffle them
        let allWords = [];
        const categoriesData = [];
        const colors = ['Yellow', 'Green', 'Blue', 'Purple'];
        if (rawData && rawData.categories) {
            rawData.categories.forEach((cat, index) => {
                const words = cat.cards.map(c => c.content);
                categoriesData.push({
                    color: colors[index],
                    name: cat.title,
                    words: words,
                });
                allWords.push(...words);
            });
        }
        // Shuffle the 16 words array
        for (let i = allWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
        }

        // 3. Assemble Markdown File
        // Categories go into YAML frontmatter so the Astro template renders them
        // properly (snippet bait for Google, 16-word box hidden from main flow).
        // The article body contains ONLY the AI-generated progressive hints.
        const categoriesYaml = categoriesData.map(c =>
            `  - color: "${c.color}"\n    name: "${c.name.replace(/"/g, '\\"')}"\n    words: [${c.words.map(w => `"${w}"`).join(', ')}]`
        ).join('\n');

        const allWordsYaml = `  [${allWords.map(w => `"${w}"`).join(', ')}]`;

        const frontmatter = `---
title: "NYT Connections Hints for ${dateString}"
date: ${dateString}
game: "connections"
categories:
${categoriesYaml}
allWords:
${allWordsYaml}
---

`;
        const fullContent = frontmatter + htmlContent;

        // 4. Write to File
        const outPath = path.resolve(__dirname, `../../src/content/connections/${dateString}.md`);
        fs.writeFileSync(outPath, fullContent, 'utf-8');
        
        console.log(`✅ Success! Created file at: ${outPath}`);
    } catch (error) {
        console.error("❌ Automation Failed:", error);
        process.exit(1);
    }
}

main();
