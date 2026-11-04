import { NextRequest, NextResponse } from 'next/server';
import { mediaLibraryService } from '@/lib/services/mediaLibraryService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderName = searchParams.get('folderName') || undefined;
    const sourceType = searchParams.get('sourceType') || undefined;
    const syndicationFilter = searchParams.get('syndicationFilter') || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await mediaLibraryService.getMediaLibrary({
      folderName,
      sourceType,
      syndicationFilter,
      search,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Asset ID is required' }, { status: 400 });
    }

    const deleted = await mediaLibraryService.deleteAsset(id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

