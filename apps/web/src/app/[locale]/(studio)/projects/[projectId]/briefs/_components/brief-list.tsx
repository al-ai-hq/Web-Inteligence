'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../../../../../../i18n/navigation';

interface Brief {
  id: string;
  primary_keyword: string;
  intent: string;
  status: string;
  created_at: string;
}

export function BriefList({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('briefs');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/${locale}/api/briefs?project_id=${projectId}`)
      .then(r => r.json())
      .then(data => { setBriefs(data.briefs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (briefs.length === 0) return <p className="text-sm text-gray-500">{t('empty_state')}</p>;

  return (
    <div className="grid gap-4">
      {briefs.map(brief => (
        <Link key={brief.id} href={`/${locale}/projects/${projectId}/briefs/${brief.id}`} className="border rounded p-4 hover:border-blue-500 transition-colors block">
          <div className="flex items-center justify-between">
            <span className="font-medium">{brief.primary_keyword}</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{brief.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{brief.intent}</p>
        </Link>
      ))}
    </div>
  );
}
