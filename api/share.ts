import { escapeHtml, isUuid, logError } from './_lib/http.js';
import { formatScore, formatTicks, modePrefix, modeQuery } from './_lib/format.js';
import { supabaseRepository, type SharedScore } from './_lib/repository.js';

// No meta refresh: link-preview crawlers follow it and would scrape the untagged game page instead.
// People are forwarded by /share-redirect.js, which crawlers don't execute.
function page(origin: string, s: SharedScore): string {
  const title = `${s.nickname} scored ${formatScore(s.score)} in Gator Gotcha`;
  const eggs = `${s.eggs} ${s.eggs === 1 ? 'egg' : 'eggs'}`;
  const desc = s.dailyDate
    ? `Daily Swamp ${s.dailyDate}: ${eggs} in ${formatTicks(s.ticks)}. Can you beat it?`
    : `${modePrefix(s.mode)}${eggs}, survived ${formatTicks(s.ticks)}. Same swamp, your turn. Can you beat it?`;
  const target = `${origin}/?seed=${encodeURIComponent(s.seed)}&challenge=${encodeURIComponent(s.id)}${modeQuery(s.mode)}`;
  const image = `${origin}/api/og?id=${encodeURIComponent(s.id)}`;
  const url = `${origin}/s/${encodeURIComponent(s.id)}`;
  const [t, d, tg, img, u] = [title, desc, target, image, url].map(escapeHtml);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gator Gotcha">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${u}">
<script src="/share-redirect.js" defer></script>
</head><body><p><a id="play" href="${tg}" data-target="${tg}">Play Gator Gotcha</a></p></body></html>`;
}

function notFound(origin: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Gator Gotcha</title><meta http-equiv="refresh" content="0;url=${escapeHtml(origin)}/"><p>That score swam away. <a href="/">Play Gator Gotcha</a></p>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!isUuid(id)) return notFound(url.origin);
  try {
    const score = await supabaseRepository().getShared(id);
    if (!score) return notFound(url.origin);
    return new Response(page(url.origin, score), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=86400',
      },
    });
  } catch (err) {
    logError('share_page_failed', { id, message: err instanceof Error ? err.message : String(err) });
    return notFound(url.origin);
  }
}

export { page as renderSharePage };
