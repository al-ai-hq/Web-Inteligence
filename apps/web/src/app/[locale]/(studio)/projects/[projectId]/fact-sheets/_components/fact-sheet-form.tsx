"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FactSheet } from "@wpi/footprint-store";

interface FactSheetFormProps {
  projectId: string;
  factSheet?: FactSheet;
}

export function FactSheetForm({ projectId, factSheet }: FactSheetFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);

    const body = {
      project_id: projectId,
      site_url: formData.get("site_url"),
      business_name: formData.get("business_name"),
      description: formData.get("description") || undefined,
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || undefined,
      address_line1: formData.get("address_line1") || undefined,
      address_locality: formData.get("address_locality") || undefined,
      address_region: formData.get("address_region") || undefined,
      address_postal_code: formData.get("address_postal_code") || undefined,
      address_country: formData.get("address_country") || undefined,
    };

    try {
      const url = factSheet
        ? `/api/fact-sheets/${factSheet.id}`
        : `/api/fact-sheets`;
      const method = factSheet ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to save fact sheet");
      }

      const saved = await response.json();
      router.push(`./${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>
      )}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium mb-1">
          Business Name *
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          defaultValue={factSheet?.business_name ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="site_url" className="block text-sm font-medium mb-1">
          Website URL *
        </label>
        <input
          id="site_url"
          name="site_url"
          type="url"
          required
          defaultValue={factSheet?.site_url ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={factSheet?.phone ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={factSheet?.email ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="address_line1" className="block text-sm font-medium mb-1">
          Street Address
        </label>
        <input
          id="address_line1"
          name="address_line1"
          type="text"
          defaultValue={factSheet?.address_line1 ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="address_locality" className="block text-sm font-medium mb-1">
            City
          </label>
          <input
            id="address_locality"
            name="address_locality"
            type="text"
            defaultValue={factSheet?.address_locality ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="address_region" className="block text-sm font-medium mb-1">
            State/Region
          </label>
          <input
            id="address_region"
            name="address_region"
            type="text"
            defaultValue={factSheet?.address_region ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="address_postal_code" className="block text-sm font-medium mb-1">
            Postal Code
          </label>
          <input
            id="address_postal_code"
            name="address_postal_code"
            type="text"
            defaultValue={factSheet?.address_postal_code ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="address_country" className="block text-sm font-medium mb-1">
            Country
          </label>
          <input
            id="address_country"
            name="address_country"
            type="text"
            defaultValue={factSheet?.address_country ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={factSheet?.description ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : factSheet ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
