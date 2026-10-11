'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../../../../../../i18n/navigation';

interface Draft {
  id: string;
  title_en: string;
  author: string;
  status: string;
  created_at: string;
}

export function DraftList({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('drafts');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/${locale}/api/drafts?project_id=${projectId}`)
      .then(r => r.json())
      .then(data => { setDrafts(data.drafts ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (drafts.length === 0) return <p className="text-sm text-gray-500">{t('empty_state')}</p>;

  return (
    <div className="grid gap-4">
      {drafts.map(draft => (
        <Link key={draft.id} href={`/${locale}/projects/${projectId}/drafts/${draft.id}`} className="border rounded p-4 hover:border-blue-500 transition-colors block">
          <div className="flex items-center justify-between">
            <span className="font-medium">{draft.title_en}</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{draft.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{draft.author}</p>
        </Link>
      ))}
    </div>
  );
}
