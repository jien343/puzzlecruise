import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const connections = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/connections" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    game: z.string().default('connections'),
    // Structured categories data for SEO snippet bait + 16-word verification
    categories: z.array(z.object({
      color: z.string(),
      name: z.string(),
      words: z.array(z.string()),
    })).optional(),
    allWords: z.array(z.string()).optional(),
  })
});

const pips = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pips" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    game: z.string().default('pips'),
    // Structured hints for SEO snippet bait and JSON-LD
    hints: z.array(z.object({
      level: z.string(),
      description: z.string(),
    })).optional(),
  })
});

const wordle = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/wordle" }),
  schema: pips.schema,
});

const strands = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/strands" }),
  schema: pips.schema,
});

export const collections = { connections, pips, wordle, strands };
