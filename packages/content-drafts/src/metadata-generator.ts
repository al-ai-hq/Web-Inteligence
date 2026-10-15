export function generateMetadata(content: { language: "ar" | "en"; body: string }[]): {
  word_count: { ar: number; en: number };
  reading_time_minutes: { ar: number; en: number };
} {
  const wordCount = { ar: 0, en: 0 };
  for (const item of content) {
    const count = item.body.split(/\s+/).filter((w) => w.length > 0).length;
    wordCount[item.language] += count;
  }
  return {
    word_count: wordCount,
    reading_time_minutes: {
      ar: Math.ceil(wordCount.ar / 200),
      en: Math.ceil(wordCount.en / 200),
    },
  };
}
