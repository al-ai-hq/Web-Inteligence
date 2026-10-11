'use client';

import { useTranslations } from 'next-intl';

interface Props {
  requiresReview: boolean;
  topic: string | null;
}

export function RegulatedClaimBadge({ requiresReview, topic }: Props) {
  const t = useTranslations('fact_manifests');

  if (!requiresReview) {
    return <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mt-2">{t('claim_safe')}</span>;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
      <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{t('regulated_claim')}</span>
      {topic && <p className="text-sm text-yellow-700 mt-1">{t('topic')}: {topic}</p>}
      <p className="text-sm text-yellow-700 mt-1">{t('review_required')}</p>
    </div>
  );
}
