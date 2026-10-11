'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Brief {
  id: string;
  primary_keyword: string;
  intent: string;
  audience: string;
  page_goal: string;
  status: string;
  created_at: string;
}

export function BriefView({ briefId, projectId, locale }: { briefId: string; projectId: string; locale: string }) {
  const t = useTranslations('briefs');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${locale}/api/briefs/${briefId}`)
      .then(r => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then(data => { setBrief(data); setLoading(false); })
      .catch(() => { setError('not_found'); setLoading(false); });
  }, [briefId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (error || !brief) return <div className="bg-red-50 text-red-700 p-3 rounded">{t('not_found')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{brief.primary_keyword}</h1>
        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">{brief.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 border rounded p-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('intent')}</dt>
          <dd>{brief.intent}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('audience')}</dt>
          <dd>{brief.audience}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-sm font-medium text-gray-500">{t('page_goal')}</dt>
          <dd>{brief.page_goal}</dd>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => fetch(`/${locale}/api/briefs/${briefId}/approve`, { method: 'POST' }).then(() => window.location.reload())}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {t('approve')}
        </button>
      </div>
    </div>
  );
}
