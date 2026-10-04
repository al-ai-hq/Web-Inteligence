export interface OAuthToken {
  userId: string;
  provider: "google";
  siteUrl: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface StoredToken {
  id: string;
  user_id: string;
  provider: string;
  site_url: string;
  access_token_encrypted: Buffer;
  refresh_token_encrypted: Buffer | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}
