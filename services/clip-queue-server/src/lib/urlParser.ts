export interface ParsedUrlResult {
  cleanUrl: string;
  platform: 'youtube' | 'youtube_shorts' | 'instagram_reel' | 'instagram_post' | 'tiktok' | 'twitter' | 'direct';
}

export function parseAndCleanUrl(rawUrl: string): ParsedUrlResult {
  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. YouTube & YouTube Shorts
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (pathname.includes('/shorts/')) {
        const shortId = pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        return {
          cleanUrl: `https://www.youtube.com/shorts/${shortId}`,
          platform: 'youtube_shorts',
        };
      } else if (host.includes('youtu.be')) {
        const id = pathname.substring(1).split('?')[0];
        return {
          cleanUrl: `https://www.youtube.com/watch?v=${id}`,
          platform: 'youtube',
        };
      } else {
        const v = parsed.searchParams.get('v');
        if (v) {
          return {
            cleanUrl: `https://www.youtube.com/watch?v=${v}`,
            platform: 'youtube',
          };
        }
      }
      return {
        cleanUrl: `${parsed.origin}${parsed.pathname}`,
        platform: 'youtube',
      };
    }

    // 2. Instagram Reels & Posts
    if (host.includes('instagram.com')) {
      if (pathname.includes('/reel/') || pathname.includes('/reels/')) {
        const parts = pathname.split('/').filter(Boolean);
        const code = parts[parts.indexOf('reel') + 1] || parts[parts.indexOf('reels') + 1] || '';
        return {
          cleanUrl: `https://www.instagram.com/reel/${code}/`,
          platform: 'instagram_reel',
        };
      }
      if (pathname.includes('/p/')) {
        const parts = pathname.split('/').filter(Boolean);
        const code = parts[parts.indexOf('p') + 1] || '';
        return {
          cleanUrl: `https://www.instagram.com/p/${code}/`,
          platform: 'instagram_post',
        };
      }
      return {
        cleanUrl: `${parsed.origin}${parsed.pathname}`,
        platform: 'instagram_post',
      };
    }

    // 3. TikTok
    if (host.includes('tiktok.com')) {
      return {
        cleanUrl: `${parsed.origin}${parsed.pathname}`,
        platform: 'tiktok',
      };
    }

    // 4. Twitter / X
    if (host.includes('twitter.com') || host.includes('x.com')) {
      return {
        cleanUrl: `${parsed.origin}${parsed.pathname}`,
        platform: 'twitter',
      };
    }

    // Default clean (strip tracking parameters)
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'si', 'igsh', 'feature', 'ref'];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));

    return {
      cleanUrl: parsed.toString(),
      platform: 'direct',
    };
  } catch {
    return {
      cleanUrl: trimmed,
      platform: 'direct',
    };
  }
}

