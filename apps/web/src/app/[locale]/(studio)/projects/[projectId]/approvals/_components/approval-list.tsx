'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../../../../../../i18n/navigation';

interface ChangeSet {
  id: string;
  status: string;
  created_at: string;
}

const RISK_TIER_COLORS: Record<string, string> = {
  '1': 'bg-green-100 text-green-800',
  '2': 'bg-yellow-100 text-yellow-800',
  '3': 'bg-red-100 text-red-800',
};

export function ApprovalList({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('approvals');
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/${locale}/api/change-sets?project_id=${projectId}`)
      .then(r => r.json())
      .then(data => { setChangeSets(data.change_sets ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (changeSets.length === 0) return <p className="text-sm text-gray-500">{t('empty_state')}</p>;

  return (
    <div className="grid gap-4">
      {changeSets.map(cs => (
        <Link key={cs.id} href={`/${locale}/projects/${projectId}/approvals/${cs.id}`} className="border rounded p-4 hover:border-blue-500 transition-colors block">
          <div className="flex items-center justify-between">
            <span className="font-medium">{cs.id.slice(0, 8)}...</span>
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{cs.status}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">{new Date(cs.created_at).toLocaleDateString()}</p>
        </Link>
      ))}
    </div>
  );
}
