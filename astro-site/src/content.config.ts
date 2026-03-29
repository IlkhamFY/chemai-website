import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const publicationsCollection = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/publications" }),
  schema: z.object({
    id: z.string().optional(),
    title: z.string(),
    authors: z.string(),
    year: z.number(),
    abstract: z.string(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
      })
    ).optional(),
    thumbnail: z.string().optional(),
  }),
});

const peopleCollection = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/people" }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    email: z.string().optional(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
        icon: z.string().optional(),
      })
    ).optional(),
    image: z.string().optional(),
  }),
});

const newsCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    blurb: z.string(),
    link: z.string().optional(),
  }),
});

export const collections = {
  'publications': publicationsCollection,
  'people': peopleCollection,
  'news': newsCollection,
};
