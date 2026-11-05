import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/db';
import { ClipQueue } from '@/models/ClipQueue';
import { VaultLead } from '@/models/VaultLead';
import { clipIngestionService } from '@/lib/services/clipIngestionService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const folder = searchParams.get('folder');
    const search = searchParams.get('search');
    const onlyLeads = searchParams.get('onlyLeads') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    const query: Record<string, any> = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (platform && platform !== 'all') {
      query.platform = { $regex: platform, $options: 'i' };
    }

    if (folder && folder !== 'all') {
      query['targetFolder.folderName'] = folder;
    }

    if (onlyLeads) {
      query['$or'] = [
        { 'contentMeta.notes': { $exists: true, $ne: '' } },
        { 'contentMeta.tags': { $in: ['vault', 'VAULT', '#VAULT', '#vault', 'lead'] } },
      ];
    }

    if (search && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s, 'i');
      query['$or'] = [
        { url: regex },
        { cleanUrl: regex },
        { 'contentMeta.title': regex },
        { 'contentMeta.author': regex },
        { 'contentMeta.notes': regex },
        { 'targetFolder.folderName': regex },
      ];
    }

    const [items, totalFiltered, totalAll, pendingCount, completedCount, failedCount, vaultLeadsCount] =
      await Promise.all([
        ClipQueue.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ClipQueue.countDocuments(query),
        ClipQueue.countDocuments({}),
        ClipQueue.countDocuments({ status: 'pending' }),
        ClipQueue.countDocuments({ status: 'completed' }),
        ClipQueue.countDocuments({ status: 'failed' }),
        ClipQueue.countDocuments({
          $or: [
            { 'contentMeta.notes': { $exists: true, $ne: '' } },
            { 'contentMeta.tags': { $in: ['vault', 'VAULT', '#VAULT', '#vault', 'lead'] } },
          ],
        }),
      ]);

    return NextResponse.json({
      success: true,
      total: totalFiltered,
      counts: {
        all: totalAll,
        pending: pendingCount,
        completed: completedCount,
        failed: failedCount,
        vaultLeads: vaultLeadsCount,
      },
      items,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process_pending';

    if (action === 'process_pending') {
      clipIngestionService.processPendingQueue().catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'Started processing pending clips in background.',
      });
    }

    if (action === 'process_single' && body.id) {
      const item = await ClipQueue.findById(body.id);
      if (!item) {
        return NextResponse.json({ success: false, error: 'Clip item not found' }, { status: 404 });
      }
      clipIngestionService.processItem(item).catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'Processing single clip in background.',
      });
    }

    if (action === 'sync_folders') {
      const count = await clipIngestionService.syncFoldersToRegistry();
      return NextResponse.json({
        success: true,
        message: `Synced ${count} folders to cloud registry.`,
      });
    }

    if (action === 'promote_to_vault_lead' && body.id) {
      const clip = await ClipQueue.findById(body.id);
      if (!clip) {
        return NextResponse.json({ success: false, error: 'Clip item not found' }, { status: 404 });
      }

      const platform = clip.platform?.includes('threads')
        ? 'threads'
        : clip.platform?.includes('facebook')
        ? 'facebook'
        : 'instagram';

      const author = clip.contentMeta?.author || 'mobile_user';
      const notes = clip.contentMeta?.notes || 'From Mobile Ingest';

      const lead = await VaultLead.create({
        platform,
        username: author.replace(/^@/, ''),
        commentText: `[Ingested from Mobile App] Note: ${notes} | URL: ${clip.cleanUrl}`,
        postTitleOrHook: clip.contentMeta?.title || clip.cleanUrl,
        status: 'new',
        notes: `Target Folder: ${clip.targetFolder?.folderName || 'General'}`,
        discoveredAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Promoted clip note to Movie Vault CRM lead successfully.',
        lead,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectMongo();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing item id' }, { status: 400 });
    }

    await ClipQueue.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Item removed from queue successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectMongo();
    const body = await req.json();
    const { id, targetFolderName, notes, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing item id' }, { status: 400 });
    }

    const update: Record<string, any> = {};
    if (targetFolderName) {
      update['targetFolder.folderName'] = targetFolderName;
    }
    if (typeof notes === 'string') {
      update['contentMeta.notes'] = notes;
    }
    if (status) {
      update.status = status;
    }

    const updated = await ClipQueue.findByIdAndUpdate(id, { $set: update }, { new: true });

    return NextResponse.json({
      success: true,
      item: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
