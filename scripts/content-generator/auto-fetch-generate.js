import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
        rawData.categories.forEach(cat => {
            const words = cat.cards.map(c => c.content).join(', ');
            const color = colors[cat.level];
            promptData += `${color}: [${words}] - ${cat.title}\n`;
        });
    } else {
        throw new Error("Invalid raw data structure from NYT");
    }

    const systemPrompt = `Act as a snarky but extremely helpful gaming KOL (Key Opinion Leader). Your job is to take the raw answers for the daily NYT Connections puzzle and convert them into our custom "Three-Stage Progressive Hint" HTML structure for our static site.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

### The Persona
- Tone: Conversational, slightly sarcastic about the puzzle setter's difficulty choices, but very encouraging to the player.
- Goal: Do not spoil the puzzle immediately. Provide hints in 3 exact stages for EACH OF THE 4 COLORS (Yellow, Green, Blue, Purple). You MUST output all 4 colors.

### The Stages (CRITICAL SEO REQUIREMENT)
To ensure we have enough engaging text for SEO and AdSense, you MUST write exactly 4 full, descriptive sentences for EACH of the Stage 1 and Stage 2 hints. Do not just output one short sentence. Write a mini-paragraph.

- Stage 1 (Category Hint): Write exactly 4 sentences giving a vague but funny hint about what the category represents. Talk about the theme in a conversational way.
- Stage 2 (Synonym/Example Hint): Write exactly 4 sentences giving the starting letter of one word, or a strong synonym for one of the words, wrapping it in snarky commentary.
- Stage 3 (Final Answer): The exact category name and the 4 words.

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

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost effective model
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here is the raw data:\n${promptData}` }
        ],
        temperature: 0.7,
    });

    return response.choices[0].message.content;
}

async function main() {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is missing in environment variables.");
        }

        // Get tomorrow's date to fetch ahead of time (Timezone Arbitrage)
        const date = new Date();
        date.setDate(date.getDate() + 1);
        const dateString = date.toISOString().split('T')[0];

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
        if (rawData && rawData.categories) {
            rawData.categories.forEach(cat => {
                cat.cards.forEach(card => {
                    allWords.push(card.content);
                });
            });
        }
        // Shuffle the array
        for (let i = allWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
        }
        const scrambledWordsStr = allWords.join(', ');

        // 3. Assemble Markdown File
        const frontmatter = `---
title: "NYT Connections Hints for ${dateString}"
date: ${dateString}
game: "connections"
---

Welcome to today's Connections hints! If you're stuck, use our progressive hints below. Don't scroll too fast!

<div class="bg-gray-800/50 border border-gray-700 p-4 rounded-md mb-8">
    <p class="text-sm text-gray-400 mb-2 font-semibold">For those checking to make sure you're on the right day, today's 16 words are:</p>
    <p class="text-gray-200 font-mono text-sm leading-relaxed">${scrambledWordsStr}</p>
</div>

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
