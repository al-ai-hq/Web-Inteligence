import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

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

interface StoredPasswordResetToken {
  userId: string;
  expiresAt: number;
  used: boolean;
}

export interface AuthService {
  createUser(email: string, password: string): Promise<SessionUser>;
  verifyCredentials(email: string, password: string): Promise<SessionUser | null>;
  createSession(userId: string): Promise<CreatedSession>;
  getSessionUser(tokenHash: string): Promise<SessionUser | null>;
  destroySession(tokenHash: string): Promise<void>;
  findUserById(userId: string): Promise<SessionUser | null>;
  createPasswordResetToken(email: string): Promise<string | null>;
  consumePasswordResetToken(token: string, newPassword: string): Promise<boolean>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemoryAuthService implements AuthService {
  private readonly usersByEmail = new Map<string, StoredUser>();
  private readonly usersById = new Map<string, StoredUser>();
  private readonly sessionsByTokenHash = new Map<string, StoredSession>();
  private readonly passwordResetTokens = new Map<string, StoredPasswordResetToken>();
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
    this.usersById.set(user.id, user);
    return { id: user.id, email: user.email };
  }

  async verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
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
    const user = this.usersById.get(userId);
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
    const user = this.usersById.get(session.userId);
    return user ? { id: user.id, email: user.email } : null;
  }

  async destroySession(tokenHash: string): Promise<void> {
    this.sessionsByTokenHash.delete(tokenHash);
  }

  async findUserById(userId: string): Promise<SessionUser | null> {
    const user = this.usersById.get(userId);
    return user ? { id: user.id, email: user.email } : null;
  }

  async createPasswordResetToken(email: string): Promise<string | null> {
    const normalized = normalizeEmail(email);
    const user = this.usersByEmail.get(normalized);
    if (!user) {
      return null;
    }
    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    this.passwordResetTokens.set(tokenHash, {
      userId: user.id,
      expiresAt: this.now() + PASSWORD_RESET_TTL_MS,
      used: false,
    });
    return token;
  }

  async consumePasswordResetToken(token: string, newPassword: string): Promise<boolean> {
    const tokenHash = hashToken(token);
    const stored = this.passwordResetTokens.get(tokenHash);
    if (!stored || stored.used || this.now() >= stored.expiresAt) {
      return false;
    }
    const user = this.usersById.get(stored.userId);
    if (!user) {
      return false;
    }
    user.passwordHash = await hashPassword(newPassword);
    stored.used = true;
    this.passwordResetTokens.delete(tokenHash);
    return true;
  }
}
