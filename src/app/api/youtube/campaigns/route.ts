import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { YouTubeCampaign } from '@/models/YouTubeCampaign';
import { YouTubeAccount } from '@/models/YouTubeAccount';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectMongo();
    const campaigns = await YouTubeCampaign.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, campaigns });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();

    const {
      channelId,
      folderName,
      name,
      privacyStatus,
      videoType,
    } = body;

    if (!channelId) {
      return NextResponse.json({ success: false, error: 'Target YouTube channel is required' }, { status: 400 });
    }

    if (!folderName) {
      return NextResponse.json({ success: false, error: 'Drive folder name is required' }, { status: 400 });
    }

    const account = await YouTubeAccount.findOne({ channelId });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Selected YouTube channel not found' }, { status: 404 });
    }

    const campaignName = (name || `${account.channelTitle} - ${folderName} Auto-Pilot`).trim();
    const currentHour = new Date().getHours();
    const defaultHours = [9, 11, 13, 15, 17, 19, 21, 23]; // 8 slots per day
    const nextSlot = defaultHours.find((h) => h > currentHour) || defaultHours[0];

    const campaign = await YouTubeCampaign.create({
      name: campaignName,
      channelId: account.channelId,
      channelTitle: account.channelTitle,
      folderName: folderName.trim(),
      status: 'active',
      dailyLimit: 8, // Enforced 8 videos per day
      uploadedTodayCount: 0,
      totalUploaded: 0,
      scheduleHours: defaultHours,
      nextScheduledSlot: `${nextSlot.toString().padStart(2, '0')}:00`,
      privacyStatus: privacyStatus || 'public',
      videoType: videoType === 'long_form' ? 'long_form' : 'short',
      aiScheduleRationale: 'Default peak audience distribution: 9 AM, 11 AM, 1 PM, 3 PM, 5 PM, 7 PM, 9 PM, 11 PM.',
    });

    return NextResponse.json({
      success: true,
      message: `Auto-Pilot Campaign "${campaign.name}" created successfully (8 videos/day limit)!`,
      campaign,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();
    const { campaignId, status } = body;

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 });
    }

    const campaign = await YouTubeCampaign.findById(campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    if (status) {
      campaign.status = status;
      await campaign.save();
    }

    return NextResponse.json({ success: true, campaign });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 });
    }

    await YouTubeCampaign.findByIdAndDelete(campaignId);
    return NextResponse.json({ success: true, message: 'Campaign deleted' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
