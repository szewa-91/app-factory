import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSignedSessionToken,
  isSessionSecretConfigured,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/session';

export async function POST(request: Request) {
  let password = '';
  try {
    const body = await request.json();
    if (typeof body?.password === 'string') {
      password = body.password;
    }
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD is not configured.');
    return NextResponse.json(
      { success: false, message: 'Dashboard authentication is not configured' },
      { status: 500 }
    );
  }

  if (!isSessionSecretConfigured()) {
    console.error('DASHBOARD_SESSION_SECRET is missing or too short.');
    return NextResponse.json(
      { success: false, message: 'Dashboard authentication is not configured' },
      { status: 500 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const token = await createSignedSessionToken();
  const response = NextResponse.json({ success: true });

  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });

  return response;
}
