import { getTranslations } from 'next-intl/server';
import { ApprovalList } from './_components/approval-list';

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  const t = await getTranslations({ locale, namespace: 'approvals' });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ApprovalList projectId={projectId} locale={locale} />
    </div>
  );
}
