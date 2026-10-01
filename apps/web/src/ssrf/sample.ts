export type SampleDisclosure = {
  coverage: "sample";
  fetched_count: number;
  site_wide_count: null;
};

export function discloseSample(fetchedCount: number): SampleDisclosure {
  return {
    coverage: "sample",
    fetched_count: fetchedCount,
    site_wide_count: null,
  };
}

export function acceptsDisclosure(result: {
  coverage: string;
  fetched_count: number;
  site_wide_count: number | null;
}): boolean {
  return result.coverage === "sample" && result.site_wide_count === null;
}
