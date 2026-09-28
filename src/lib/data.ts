/**
 * Hand-edited site data (src/data/*.yaml), parsed at build time.
 * Imported with `?raw` so the dev server reloads when a YAML file changes.
 */
import { parse } from 'yaml';
import profileRaw from '../data/profile.yaml?raw';
import cvRaw from '../data/cv.yaml?raw';
import lifeRaw from '../data/life.yaml?raw';

export interface ResearchTheme {
  key: string;
  title: string;
  oneLiner: string;
  question: string;
  details: string;
}

export interface Profile {
  name: string;
  tagline: string;
  affiliation: string;
  location: string;
  timezone: string;
  email: string;
  quickFacts: { k: string; v: string }[];
  links: Record<'cv' | 'github' | 'scholar' | 'twitter' | 'linkedin', string>;
  portraits: { fallback: string; photo: string; illustrations: string[] };
  about: string;
  researchThemes: ResearchTheme[];
  featuredWork: { title: string; status: string; links: Record<string, string> };
  motto: string;
  credit: string;
  creditUrl: string;
  copyright: string;
}

export interface CV {
  education: { where: string; what: string; when: string; location: string }[];
  experience: { title: string; subtitle: string; when: string; location: string; bullets: string[] }[];
  teaching: { title: string; when: string }[];
  honors: { title: string; when: string }[];
  skills: Record<string, string[]>;
}

export interface LifeMeta {
  intro: string;
  quickLinks: { label: string; href: string; note?: string }[];
  notes: { title: string; body: string }[];
}

export const profile = parse(profileRaw) as Profile;
export const cv = parse(cvRaw) as CV;
export const lifeMeta = parse(lifeRaw) as LifeMeta;
