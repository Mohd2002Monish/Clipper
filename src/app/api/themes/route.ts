import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { Theme } from '@/models/Theme';
import { THEME_PRESETS } from '@/shared/themes';
import { IThemePreset } from '@/shared/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();

    // Fetch user-created custom themes from MongoDB
    const customThemesDocs = await Theme.find().sort({ createdAt: -1 }).lean();

    const customThemes: IThemePreset[] = customThemesDocs.map((doc: any) => ({
      id: `custom-${doc._id.toString()}`,
      name: doc.name,
      description: doc.description || 'Custom styled overlay & subtitle theme',
      badge: doc.badge || 'Custom',
      colorPreview: doc.colorPreview || {
        bg: '#000000',
        text: '#FFFFFF',
        border: '#2196F3',
      },
      isCustom: true,
      top: doc.top,
      bottom: doc.bottom,
      aiSubtitles: doc.aiSubtitles,
    }));

    // Put predefined themes first, then custom saved themes, with default "custom" editor at the end
    const standardPresets = THEME_PRESETS.filter((p) => p.id !== 'custom');
    const customBuilder = THEME_PRESETS.find((p) => p.id === 'custom')!;

    const combinedThemes = [...standardPresets, ...customThemes, customBuilder];

    return NextResponse.json({
      success: true,
      themes: combinedThemes,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Theme name is required' },
        { status: 400 }
      );
    }

    if (!body.top || !body.bottom) {
      return NextResponse.json(
        { success: false, error: 'Theme top and bottom configuration are required' },
        { status: 400 }
      );
    }

    const description = (body.description || '').trim() || 'Custom user overlay theme';
    const badge = body.badge || 'Custom';
    const colorPreview = body.colorPreview || {
      bg: body.top?.bgBoxColor || '#000000',
      text: body.top?.fontColor || '#FFFFFF',
      border: body.top?.fontColor || '#2196F3',
    };

    const newTheme = await Theme.create({
      name,
      description,
      badge,
      colorPreview,
      isCustom: true,
      top: body.top,
      bottom: body.bottom,
      aiSubtitles: body.aiSubtitles,
    });

    return NextResponse.json({
      success: true,
      theme: {
        id: `custom-${newTheme._id.toString()}`,
        name: newTheme.name,
        description: newTheme.description,
        badge: newTheme.badge,
        colorPreview: newTheme.colorPreview,
        isCustom: true,
        top: newTheme.top,
        bottom: newTheme.bottom,
        aiSubtitles: newTheme.aiSubtitles,
      },
      message: `Theme "${name}" saved successfully`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Theme ID required' }, { status: 400 });
    }

    const cleanId = id.replace(/^custom-/, '');
    await Theme.findByIdAndDelete(cleanId);

    return NextResponse.json({ success: true, message: 'Custom theme deleted' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
