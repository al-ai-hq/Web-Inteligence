'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Manifest {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export function ManifestList({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('fact_manifests');
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/${locale}/api/fact-manifests?project_id=${projectId}`)
      .then(r => r.json())
      .then(data => { setManifests(data.manifests ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, locale]);

  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (manifests.length === 0) return <p className="text-sm text-gray-500">{t('empty_state')}</p>;

  return (
    <div className="grid gap-4">
      {manifests.map(manifest => (
        <div key={manifest.id} className="border rounded p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{manifest.title}</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{manifest.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{new Date(manifest.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
