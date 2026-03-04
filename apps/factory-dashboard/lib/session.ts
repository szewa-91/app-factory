const SESSION_SEPARATOR = '.';

export const SESSION_COOKIE_NAME = 'dashboard-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string | null {
  const secret = process.env.DASHBOARD_SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    return null;
  }

  return secret;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signSessionPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(signature);
}

export function isSessionSecretConfigured(): boolean {
  return getSessionSecret() !== null;
}

export async function createSignedSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error(
      'DASHBOARD_SESSION_SECRET must be set and at least 32 characters long.'
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const signature = await signSessionPayload(payload, secret);

  return `${payload}${SESSION_SEPARATOR}${signature}`;
}

export async function verifySignedSessionToken(token: string | undefined): Promise<boolean> {
  if (!token || token.length > 1024) {
    return false;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return false;
  }

  const parts = token.split(SESSION_SEPARATOR);
  if (parts.length !== 2) {
    return false;
  }

  const [payload, signature] = parts;
  if (!/^\d+$/.test(payload)) {
    return false;
  }

  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now) {
    return false;
  }

  const expectedSignature = await signSessionPayload(payload, secret);
  return constantTimeEqual(signature, expectedSignature);
}
