import { getTranslations } from 'next-intl/server';
import { ManifestList } from './_components/manifest-list';
import { FactForm } from './_components/fact-form';

export default async function FactManifestsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  const t = await getTranslations({ locale, namespace: 'fact_manifests' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <FactForm projectId={projectId} locale={locale} />
      <ManifestList projectId={projectId} locale={locale} />
    </div>
  );
}
