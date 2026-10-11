'use client';

import { useTranslations } from 'next-intl';

export function SchemaPreview({ locale }: { locale: string }) {
  const t = useTranslations('schema');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('preview')}</h2>
      <div className="border rounded p-4 bg-gray-50">
        <p className="text-sm text-gray-500">{t('preview_description')}</p>
        <pre className="mt-4 text-xs font-mono whitespace-pre-wrap">{`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "author": "...",
  "datePublished": "..."
}`}</pre>
      </div>
    </div>
  );
}
