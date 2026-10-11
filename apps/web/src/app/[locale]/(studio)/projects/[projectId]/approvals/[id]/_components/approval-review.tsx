'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ChangeSet {
  id: string;
  manifest_id: string;
  status: string;
  items: Array<{ fact_id: string; action: string; content: string }>;
  created_at: string;
}

export function ApprovalReview({ changeSetId, locale }: { changeSetId: string; locale: string }) {
  const t = useTranslations('approvals');
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${locale}/api/change-sets/${changeSetId}`)
      .then(r => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then(data => { setChangeSet(data); setLoading(false); })
      .catch(() => { setError('not_found'); setLoading(false); });
  }, [changeSetId, locale]);

  async function handleApprove() {
    const res = await fetch(`/${locale}/api/change-sets/${changeSetId}/approve`, { method: 'POST' });
    if (res.ok) window.location.reload();
  }

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (error || !changeSet) return <div className="bg-red-50 text-red-700 p-3 rounded">{t('not_found')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('change_set')} {changeSet.id.slice(0, 8)}</h2>
        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">{changeSet.status}</span>
      </div>
      <div className="border rounded p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">{t('items')}</h3>
        {changeSet.items?.length > 0 ? (
          <div className="space-y-2">
            {changeSet.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`text-xs px-2 py-0.5 rounded ${item.action === 'add' ? 'bg-green-100 text-green-800' : item.action === 'remove' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.action}</span>
                <span className="font-mono text-xs">{item.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('no_items')}</p>
        )}
      </div>
      {changeSet.status === 'pending_review' && (
        <div className="flex gap-2">
          <button onClick={handleApprove} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('approve')}</button>
        </div>
      )}
    </div>
  );
}
