export function normalizeArabicKeyword(keyword: string): string {
  return keyword
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, '')
    .replace(/[\u064B-\u065F]/g, '');
}

export function processKeywordVariants(
  variants: { keyword: string; language: 'ar' | 'en' }[]
): { keyword: string; language: 'ar' | 'en'; normalized: string }[] {
  return variants.map(v => ({
    ...v,
    normalized: v.language === 'ar' ? normalizeArabicKeyword(v.keyword) : v.keyword,
  }));
}
