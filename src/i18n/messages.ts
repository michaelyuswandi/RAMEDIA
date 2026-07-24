import { en } from './locales/en';
import { id } from './locales/id';

export const messages = {
  en,
  id,
} as const;

export type MessageTree = typeof messages.en;
