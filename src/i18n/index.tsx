import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { messages } from './messages';

export type LocaleCode = 'en' | 'id';

type TranslationValues = Record<string, string | number>;

interface I18nValue {
  locale: LocaleCode;
  t: (key: string, values?: TranslationValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookupMessage(tree: Record<string, unknown>, key: string): string | null {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return null;
    return (current as Record<string, unknown>)[part];
  }, tree);

  return typeof value === 'string' ? value : null;
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function I18nProvider({ locale, children }: { locale: LocaleCode; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (key, values) => {
      const primary = lookupMessage(messages[locale], key);
      const fallback = lookupMessage(messages.id, key) ?? key;
      return interpolate(primary ?? fallback, values);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: 'id' as LocaleCode,
      t: (key: string, values?: TranslationValues) => {
        const primary = lookupMessage(messages.id, key) ?? lookupMessage(messages.en, key) ?? key;
        return interpolate(primary, values);
      },
    };
  }
  return context;
}

export function getIntlLocale(locale: LocaleCode) {
  return locale === 'id' ? 'id-ID' : 'en-US';
}
