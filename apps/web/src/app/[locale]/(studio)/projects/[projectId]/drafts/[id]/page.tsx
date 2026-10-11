import { getTranslations } from 'next-intl/server';
import { Link } from '../../../../../../../i18n/navigation';
import { DraftView } from './_components/draft-view';

export default async function DraftDetailPage({ params }: { params: Promise<{ locale: string; projectId: string; id: string }> }) {
  const { locale, projectId, id } = await params;
  const t = await getTranslations({ locale, namespace: 'drafts' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link href={`/${locale}/projects/${projectId}/drafts`} className="text-blue-600 hover:underline">
        {t('back_to_list')}
      </Link>
      <DraftView draftId={id} projectId={projectId} locale={locale} />
    </div>
  );
}
