const DEFAULT_EXPIRY_DAYS = 7;

export function isApprovalExpired(
  approvedAt: Date,
  now: Date,
  expiryDays: number = DEFAULT_EXPIRY_DAYS,
): boolean {
  const expiryDate = new Date(approvedAt);
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return now > expiryDate;
}
