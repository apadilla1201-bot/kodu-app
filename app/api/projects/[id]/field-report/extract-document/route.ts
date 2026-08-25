export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { askClaudeWithPdf } from '@/lib/ai';
import mammoth from 'mammoth';

const EXTRACT_TEXT_PROMPT = `Extract ALL readable text from this document. Preserve paragraph breaks and bullet points. Return only the extracted text, with no commentary or markdown formatting.`;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      const base64 = buffer.toString('base64');
      extractedText = await askClaudeWithPdf({
        prompt: EXTRACT_TEXT_PROMPT,
        pdfBase64: base64,
        mediaType: 'application/pdf',
        maxTokens: 8000,
      });
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF or Word (.docx).' },
        { status: 400 },
      );
    }

    return NextResponse.json({ text: extractedText.trim() });
  } catch (error: any) {
    console.error('Extract document error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to extract document text' },
      { status: 500 },
    );
  }
}
