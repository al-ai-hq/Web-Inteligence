'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const SCHEMA_TYPES = ['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList'] as const;

export function SchemaForm({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations('schema');
  const [schemaType, setSchemaType] = useState<string>('Article');
  const [jsonData, setJsonData] = useState<string>('{\n  "headline": "",\n  "author": "",\n  "datePublished": ""\n}');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function handleBuild() {
    setError(null);
    setResult(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonData);
    } catch {
      setError(t('invalid_json'));
      return;
    }
    const res = await fetch(`/${locale}/api/schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_type: schemaType, data, project_id: projectId }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Failed to build schema');
      return;
    }
    setResult(await res.json());
  }

  async function handleValidate() {
    setError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonData);
    } catch {
      setError(t('invalid_json'));
      return;
    }
    const res = await fetch(`/${locale}/api/schema/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: data }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Validation failed');
      return;
    }
    setResult(await res.json());
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('builder')}</h2>
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">{t('schema_type')}</label>
        <select value={schemaType} onChange={e => setSchemaType(e.target.value)} className="w-full border rounded px-3 py-2">
          {SCHEMA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('json_data')}</label>
        <textarea value={jsonData} onChange={e => setJsonData(e.target.value)} rows={10} className="w-full border rounded px-3 py-2 font-mono text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleBuild} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('build')}</button>
        <button onClick={handleValidate} className="border px-4 py-2 rounded hover:bg-gray-50">{t('validate')}</button>
      </div>
      {result != null && (
        <div className="border rounded p-4">
          <h3 className="text-sm font-medium mb-2">{t('result')}</h3>
          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
