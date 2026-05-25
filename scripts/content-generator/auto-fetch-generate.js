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

    const systemPrompt = `You are an expert gaming journalist and SEO content writer. Your task is to write a highly engaging, long-form blog post (at least 400-500 words) about today's NYT Connections puzzle. 
This content must pass Google's Helpful Content Update and get approved for AdSense, so it must be substantial, original, and helpful.

IMPORTANT INSTRUCTION: Your ENTIRE output MUST be strictly in English. Do NOT output any Chinese text whatsoever. 

Structure your response EXACTLY as follows in Markdown (mixed with our custom HTML for hints):

1. **Introduction (150+ words):** Write a captivating intro about today's Connections puzzle. Discuss the overall difficulty, mention the date, and talk about any tricky words or overlaps without spoiling the actual categories. Use SEO keywords naturally: "NYT Connections hints today", "puzzle answers", "strategy".
2. **Strategy Overview (100+ words):** Give general advice for today's board. For example, "Watch out for verbs that look like nouns," or "There's a sneaky crossover between color words and fruits."
3. **Progressive Hints Section:** Introduce the hints. Then, output the following EXACT HTML structure for each of the 4 colors (Yellow, Green, Blue, Purple). 

For the hints, follow this logic:
- Stage 1 (Category Hint): A vague hint about what the category represents.
- Stage 2 (Synonym/Example Hint): Give the starting letter of one word, or a strong synonym for one of the words.
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

4. **Conclusion (50+ words):** A friendly wrap-up asking the reader how they did, encouraging them to keep their streak alive, and reminding them to bookmark PuzzleCruise for tomorrow.

Do not output code blocks (\`\`\`) around the HTML. Just output the raw Markdown and HTML.`;

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

        // 3. Assemble Markdown File
        const frontmatter = `---
title: "NYT Connections Hints for ${dateString}"
date: ${dateString}
game: "connections"
---

Welcome to today's Connections hints! If you're stuck, use our progressive hints below. Don't scroll too fast!

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
