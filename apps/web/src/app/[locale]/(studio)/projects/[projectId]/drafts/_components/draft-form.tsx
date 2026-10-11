'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function DraftForm({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('drafts');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const body = {
      brief_id: formData.get('brief_id') as string,
      project_id: projectId,
      title_en: formData.get('title_en') as string,
      title_ar: formData.get('title_ar') as string || undefined,
      content_en: formData.get('content_en') as string,
      content_ar: formData.get('content_ar') as string || undefined,
      author: formData.get('author') as string,
    };
    const res = await fetch(`/${locale}/api/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to create draft');
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
          <label className="block text-sm font-medium mb-1">{t('brief_id')}</label>
          <input name="brief_id" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('author')}</label>
          <input name="author" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('title_en')}</label>
          <input name="title_en" required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('title_ar')}</label>
          <input name="title_ar" dir="rtl" className="w-full border rounded px-3 py-2" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('content_en')}</label>
        <textarea name="content_en" required rows={6} className="w-full border rounded px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('content_ar')}</label>
        <textarea name="content_ar" dir="rtl" rows={6} className="w-full border rounded px-3 py-2" />
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('create')}</button>
    </form>
  );
}
