import { getTranslations } from 'next-intl/server';
import { BriefList } from './_components/brief-list';
import { BriefForm } from './_components/brief-form';

export default async function BriefsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  const t = await getTranslations({ locale, namespace: 'briefs' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <BriefForm projectId={projectId} locale={locale} />
      <BriefList projectId={projectId} locale={locale} />
    </div>
  );
}
