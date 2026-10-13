import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("email_taken");
    this.name = "DuplicateEmailError";
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

interface StoredSession {
  userId: string;
  expiresAt: number;
  lastSeenAt: number;
}

export interface AuthService {
  createUser(email: string, password: string): Promise<SessionUser>;
  verifyCredentials(email: string, password: string): Promise<SessionUser | null>;
  createSession(userId: string): Promise<CreatedSession>;
  getSessionUser(tokenHash: string): Promise<SessionUser | null>;
  destroySession(tokenHash: string): Promise<void>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryAuthService implements AuthService {
  private readonly usersByEmail = new Map<string, StoredUser>();
  private readonly sessionsByTokenHash = new Map<string, StoredSession>();
  private userCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  async createUser(email: string, password: string): Promise<SessionUser> {
    const normalized = normalizeEmail(email);
    if (this.usersByEmail.has(normalized)) {
      throw new DuplicateEmailError();
    }
    this.userCounter += 1;
    const user: StoredUser = {
      id: `user-${this.userCounter}`,
      email: normalized,
      passwordHash: await hashPassword(password),
    };
    this.usersByEmail.set(normalized, user);
    return { id: user.id, email: user.email };
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<SessionUser | null> {
    const user = this.usersByEmail.get(normalizeEmail(email));
    if (!user) {
      await hashPassword(password);
      return null;
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return null;
    }
    return { id: user.id, email: user.email };
  }

  async createSession(userId: string): Promise<CreatedSession> {
    const user = [...this.usersByEmail.values()].find(
      (candidate) => candidate.id === userId,
    );
    if (!user) {
      throw new Error(`Unknown user ${userId}`);
    }
    const current = this.now();
    const token = generateSessionToken();
    this.sessionsByTokenHash.set(hashToken(token), {
      userId,
      expiresAt: current + SESSION_TTL_MS,
      lastSeenAt: current,
    });
    return { token, expiresAt: new Date(current + SESSION_TTL_MS) };
  }

  async getSessionUser(tokenHash: string): Promise<SessionUser | null> {
    const current = this.now();
    const session = this.sessionsByTokenHash.get(tokenHash);
    if (!session) {
      return null;
    }
    if (current >= session.expiresAt) {
      this.sessionsByTokenHash.delete(tokenHash);
      return null;
    }
    if (current - session.lastSeenAt > SESSION_RENEWAL_THRESHOLD_MS) {
      session.expiresAt = current + SESSION_TTL_MS;
      session.lastSeenAt = current;
    }
    const user = [...this.usersByEmail.values()].find(
      (candidate) => candidate.id === session.userId,
    );
    return user ? { id: user.id, email: user.email } : null;
  }

  async destroySession(tokenHash: string): Promise<void> {
    this.sessionsByTokenHash.delete(tokenHash);
  }
}
