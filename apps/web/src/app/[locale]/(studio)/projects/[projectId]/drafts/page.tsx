import { getTranslations } from 'next-intl/server';
import { DraftList } from './_components/draft-list';
import { DraftForm } from './_components/draft-form';

export default async function DraftsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  const t = await getTranslations({ locale, namespace: 'drafts' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <DraftForm projectId={projectId} locale={locale} />
      <DraftList projectId={projectId} locale={locale} />
    </div>
  );
}
