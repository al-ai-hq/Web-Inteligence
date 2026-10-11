import { getTranslations } from 'next-intl/server';
import { Link } from '../../../../../../../i18n/navigation';
import { ApprovalReview } from './_components/approval-review';

export default async function ApprovalDetailPage({ params }: { params: Promise<{ locale: string; projectId: string; id: string }> }) {
  const { locale, projectId, id } = await params;
  const t = await getTranslations({ locale, namespace: 'approvals' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link href={`/${locale}/projects/${projectId}/approvals`} className="text-blue-600 hover:underline">
        {t('back_to_list')}
      </Link>
      <ApprovalReview changeSetId={id} locale={locale} />
    </div>
  );
}
