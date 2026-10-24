import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Subtitle generation is currently disabled. See ROADMAP.md for upcoming local Whisper integration.',
    subtitles: [],
    count: 0,
  });
}
