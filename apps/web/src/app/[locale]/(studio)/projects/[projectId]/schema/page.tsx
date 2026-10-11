import { getTranslations } from 'next-intl/server';
import { SchemaForm } from './_components/schema-form';
import { SchemaPreview } from './_components/schema-preview';

export default async function SchemaPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  const t = await getTranslations({ locale, namespace: 'schema' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <div className="grid grid-cols-2 gap-8">
        <SchemaForm projectId={projectId} locale={locale} />
        <SchemaPreview locale={locale} />
      </div>
    </div>
  );
}
