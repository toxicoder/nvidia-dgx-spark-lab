export declare const SUPPORTED_LANGUAGE_LOCALES: Record<string, string>;
export declare const MULTILINGUAL_LANGUAGE: 'multilingual';
export declare const SPLITTERS: Record<SupportedLanguage, RegExp>;
export declare const SUPPORTED_LANGUAGES: string[];
export declare function getLocale(language: string | undefined): string | undefined;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type Language = SupportedLanguage | typeof MULTILINGUAL_LANGUAGE;
export declare const LANGUAGES_WITH_SIGNIFICANT_DIACRITICS: Set<string>;
