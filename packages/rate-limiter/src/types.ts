export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  checkAnonymous(ip: string, now?: Date): Promise<RateLimitResult>;
  checkUser(userId: string, projectId: string, now?: Date): Promise<RateLimitResult>;
  recordFailure(ip: string, now?: Date): Promise<void>;
  isSuspicious(ip: string, now?: Date): Promise<boolean>;
}
