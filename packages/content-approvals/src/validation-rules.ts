export interface ChangeItem {
  field_name: string;
  new_value: string;
}

const LENGTH_LIMITS: Record<string, number> = {
  title: 60,
  meta_description: 160,
  h1: 70,
  og_title: 60,
  og_description: 200,
};

export function validateChangeItem(item: ChangeItem): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const limit = LENGTH_LIMITS[item.field_name];
  if (limit && item.new_value.length > limit) {
    errors.push(`${item.field_name} exceeds maximum length of ${limit} characters`);
  }
  return { valid: errors.length === 0, errors };
}
