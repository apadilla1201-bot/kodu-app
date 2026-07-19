export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyResetToken } from '@/lib/password-reset';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? '');
    const password = String(body?.password ?? '');

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Decode uid from the payload (untrusted) to look the user up, then
    // verify the signature against the user's CURRENT password hash.
    let uid = '';
    try {
      const bodyPart = token.split('.')[0];
      uid = JSON.parse(Buffer.from(bodyPart, 'base64url').toString())?.uid ?? '';
    } catch { /* fallthrough */ }
    if (!uid) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    }

    const payload = verifyResetToken(token, { id: user.id, email: user.email, password: user.password });
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired link. Please request a new one.' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[reset-password] Error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
