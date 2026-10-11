'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Draft {
  id: string;
  brief_id: string;
  title_en: string;
  title_ar?: string;
  content_en: string;
  content_ar?: string;
  author: string;
  status: string;
  created_at: string;
}

export function DraftView({ draftId, projectId, locale }: { draftId: string; projectId: string; locale: string }) {
  const t = useTranslations('drafts');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${locale}/api/drafts/${draftId}`)
      .then(r => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then(data => { setDraft(data); setLoading(false); })
      .catch(() => { setError('not_found'); setLoading(false); });
  }, [draftId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (error || !draft) return <div className="bg-red-50 text-red-700 p-3 rounded">{t('not_found')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{draft.title_en}</h1>
        <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">{draft.status}</span>
      </div>
      {draft.title_ar && (
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('title_ar')}</dt>
          <dd dir="rtl" className="text-lg font-semibold">{draft.title_ar}</dd>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 border rounded p-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('author')}</dt>
          <dd>{draft.author}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('brief_id')}</dt>
          <dd>{draft.brief_id}</dd>
        </div>
      </div>
      <div className="border rounded p-4 space-y-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">{t('content_en')}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{draft.content_en}</dd>
        </div>
        {draft.content_ar && (
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('content_ar')}</dt>
            <dd dir="rtl" className="mt-1 whitespace-pre-wrap">{draft.content_ar}</dd>
          </div>
        )}
      </div>
    </div>
  );
}
