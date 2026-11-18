/**
 * Safely parses JSON from a fetch Response object.
 * Protects against unexpected HTML responses (e.g. 500/404 server errors, redirects).
 */
export async function safeFetchJson<T = any>(
  res: Response,
  fallbackErrorMessage = 'Unexpected response from server'
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!text || text.trim() === '') {
      return {
        ok: res.ok,
        data: null,
        error: res.ok ? null : `${fallbackErrorMessage} (${res.status} ${res.statusText})`,
      };
    }

    // Check if response looks like HTML error page
    if (text.trim().startsWith('<') || (!contentType.includes('application/json') && text.includes('<!DOCTYPE'))) {
      const preview = text.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 120);
      return {
        ok: false,
        data: null,
        error: `Server returned an error (${res.status} ${res.statusText}): ${preview || 'Non-JSON response'}`,
      };
    }

    const data = JSON.parse(text) as T;
    return {
      ok: res.ok,
      data,
      error: res.ok ? null : (data as any)?.error || `${fallbackErrorMessage} (${res.status})`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      data: null,
      error: `${fallbackErrorMessage}: ${msg}`,
    };
  }
}
