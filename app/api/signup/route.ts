export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Signup público con selección de plan (Step 4b).
// El plan elegido se guarda DIRECTO en Company.plan (starter | pro | enterprise).
// Enterprise NO se auto-aprovisiona: se crea como 'starter' y se marca para
// seguimiento manual (venta asistida).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, companyName, plan: rawPlan } = body ?? {};

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

    // Whitelist de planes válidos — nunca confiar en el cliente.
    const requestedPlan = ['starter', 'pro', 'enterprise'].includes(rawPlan)
      ? rawPlan
      : 'starter';

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

    const displayName = name ?? email?.split?.('@')?.[0] ?? 'User';

    // FIX P0 (existente): provisionar Company (tenant) por cada signup.
    // Step 4b: el nombre de la compañía lo puede dar el usuario; si no,
    // se deriva de su nombre como antes.
    const finalCompanyName =
      companyName && String(companyName).trim().length > 0
        ? String(companyName).trim()
        : `${displayName}'s Company`;

    // Enterprise = venta asistida: se crea en starter y queda marcada en el
    // nombre para que Augusto la contacte y la suba a mano tras el acuerdo.
    const isEnterpriseLead = requestedPlan === 'enterprise';

    // Regla de marca (2026-08): el logo PDG queda EXCLUSIVO de la compañía
    // "The Project Delivery Group LLC" (los proyectos reales de Augusto).
    // Cualquier otra compañía nueva nace SIN logo → la app muestra el
    // wordmark koduPM hasta que suba el suyo desde Settings.
    const isPDG = /project\s*delivery\s*group/i.test(finalCompanyName);

    const company = await prisma.company.create({
      data: {
        name: isEnterpriseLead
          ? `${finalCompanyName} [ENTERPRISE LEAD]`
          : finalCompanyName,
        plan: isEnterpriseLead ? 'starter' : requestedPlan,
        logoUrl: isPDG ? '/pdg_logo.png' : null,
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
      {
        message: 'User created successfully',
        userId: user?.id,
        plan: company.plan,
        enterpriseLead: isEnterpriseLead,
      },
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
