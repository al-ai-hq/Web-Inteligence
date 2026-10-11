'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { RegulatedClaimBadge } from './regulated-claim-badge';

export function FactForm({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('fact_manifests');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [claimText, setClaimText] = useState('');
  const [claimResult, setClaimResult] = useState<{ requires_review: boolean; topic: string | null } | null>(null);

  async function handleCheckClaim() {
    if (!claimText.trim()) return;
    const res = await fetch(`/${locale}/api/fact-manifests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, title: claimText }),
    });
    if (res.ok) {
      const data = await res.json();
      setClaimResult({ requires_review: false, topic: null });
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const body = {
      project_id: projectId,
      title: formData.get('title') as string,
    };
    const res = await fetch(`/${locale}/api/fact-manifests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to create manifest');
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="border rounded p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t('create_new')}</h2>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">{t('manifest_title')}</label>
        <input name="title" required className="w-full border rounded px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('check_claim')}</label>
        <div className="flex gap-2">
          <input value={claimText} onChange={e => setClaimText(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder={t('enter_claim')} />
          <button type="button" onClick={handleCheckClaim} className="border px-4 py-2 rounded hover:bg-gray-50">{t('check')}</button>
        </div>
        {claimResult && <RegulatedClaimBadge requiresReview={claimResult.requires_review} topic={claimResult.topic} />}
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('create')}</button>
    </form>
  );
}
