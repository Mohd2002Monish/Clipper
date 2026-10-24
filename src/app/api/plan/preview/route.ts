import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/services/plannerService';
import { SplitSettingsSchema } from '@/shared/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PlanPreviewRequestSchema = z.object({
  sourceDuration: z.number().positive(),
  originalFilename: z.string().default('video.mp4'),
  splitSettings: SplitSettingsSchema,
  filenameTemplate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = PlanPreviewRequestSchema.parse(body);

    const result = plannerService.computePlan({
      sourceDuration: validated.sourceDuration,
      originalFilename: validated.originalFilename,
      splitSettings: validated.splitSettings,
      filenameTemplate: validated.filenameTemplate,
    });

    return NextResponse.json({
      success: true,
      parts: result.plan,
      ...result,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid plan settings format', details: err.errors },
        { status: 400 }
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
