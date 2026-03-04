import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
