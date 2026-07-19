export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // FIX P0: provision a Company (tenant) for every new signup.
    // Without it, the user has companyId = NULL and POST /api/projects
    // fails with a FK violation (companyId='') — new users could never
    // create their first project.
    const displayName = name ?? email?.split?.('@')?.[0] ?? 'User';

    const company = await prisma.company.create({
      data: {
        name: `${displayName}'s Company`,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: displayName,
        role: 'owner',
        companyId: company.id,
      },
    });

    return NextResponse.json(
      { message: 'User created successfully', userId: user?.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
