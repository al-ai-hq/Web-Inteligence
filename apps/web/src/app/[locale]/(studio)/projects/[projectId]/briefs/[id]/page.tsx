import { getTranslations } from 'next-intl/server';
import { Link } from '../../../../../../../i18n/navigation';
import { BriefView } from './_components/brief-view';

export default async function BriefDetailPage({ params }: { params: Promise<{ locale: string; projectId: string; id: string }> }) {
  const { locale, projectId, id } = await params;
  const t = await getTranslations({ locale, namespace: 'briefs' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link href={`/${locale}/projects/${projectId}/briefs`} className="text-blue-600 hover:underline">
        {t('back_to_list')}
      </Link>
      <BriefView briefId={id} projectId={projectId} locale={locale} />
    </div>
  );
}
