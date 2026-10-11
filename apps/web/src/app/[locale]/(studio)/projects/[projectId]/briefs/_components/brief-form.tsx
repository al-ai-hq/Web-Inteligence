'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function BriefForm({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('briefs');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const body = {
      project_id: projectId,
      primary_keyword: formData.get('primary_keyword') as string,
      intent: formData.get('intent') as string,
      audience: formData.get('audience') as string,
      page_goal: formData.get('page_goal') as string,
    };
    const res = await fetch(`/${locale}/api/briefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to create brief');
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="border rounded p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t('create_new')}</h2>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('primary_keyword')}</label>
          <input name="primary_keyword" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('intent')}</label>
          <select name="intent" required className="w-full border rounded px-3 py-2">
            <option value="informational">Informational</option>
            <option value="transactional">Transactional</option>
            <option value="navigational">Navigational</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('audience')}</label>
          <input name="audience" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('page_goal')}</label>
          <input name="page_goal" required className="w-full border rounded px-3 py-2" />
        </div>
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('create')}</button>
    </form>
  );
}
