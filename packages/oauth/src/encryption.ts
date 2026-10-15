import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hexKey = process.env["ENCRYPTION_KEY"];
  if (hexKey) {
    const keyBuffer = Buffer.from(hexKey, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)");
    }
    return keyBuffer;
  }

  const b64Key = process.env["WPI_OAUTH_ENCRYPTION_KEY"];
  if (b64Key) {
    const keyBuffer = Buffer.from(b64Key, "base64");
    if (keyBuffer.length !== 32) {
      throw new Error("WPI_OAUTH_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
    }
    return keyBuffer;
  }

  throw new Error("ENCRYPTION_KEY (or WPI_OAUTH_ENCRYPTION_KEY) environment variable is required");
}

export function encrypt(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(encrypted: Buffer): string {
  const key = getEncryptionKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString("utf8");
}
