export const SESSION_COOKIE_NAME = "wpi_session";
export const SESSION_MAX_AGE_SECONDS = 2_592_000;

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env["NODE_ENV"] === "production",
  };
}
