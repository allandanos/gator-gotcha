import { readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { isUuid, logError } from './_lib/http';
import { formatScore, formatTicks } from './_lib/format';
import { supabaseRepository, type SharedScore } from './_lib/repository';

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

const INK = '#24331c';
const WIDTH = 1200;
const HEIGHT = 630;
const font = readFile(new URL('./_fonts/LilitaOne-Regular.ttf', import.meta.url));

function stat(label: string, value: string): Node {
  return h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 36px' }, [
    h('div', { fontSize: 30, color: '#5d6b4f' }, label.toUpperCase()),
    h('div', { fontSize: 64, color: INK }, value),
  ]);
}

function card(s: SharedScore | null): Node {
  const headline = s ? `${s.nickname} scored` : 'Grab eggs. Dodge the gator.';
  return h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #4cc3e0 0%, #4cc3e0 18%, #8fd14f 18%, #78bd3c 100%)',
      fontFamily: 'Lilita One',
    },
    h(
      'div',
      {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#fff8e7',
        border: `6px solid ${INK}`,
        borderRadius: 40,
        boxShadow: `14px 14px 0 ${INK}`,
        padding: '36px 64px',
        transform: 'rotate(-1.5deg)',
      },
      [
        h('div', { fontSize: 44, color: '#4fae5a', marginBottom: 4 }, 'GATOR GOTCHA!'),
        h('div', { fontSize: 46, color: INK }, headline),
        ...(s
          ? [
              h('div', { fontSize: 150, color: '#ffd84d', textShadow: `6px 6px 0 ${INK}`, lineHeight: 1 }, formatScore(s.score)),
              h('div', { display: 'flex', marginTop: 18 }, [
                stat('Eggs', String(s.eggs)),
                stat('Survived', formatTicks(s.ticks)),
                stat('Swamp', s.dailyDate ? 'Daily' : s.seed),
              ]),
            ]
          : []),
        h('div', { fontSize: 36, color: '#ff5a4e', marginTop: 16 }, 'Can you beat it?'),
      ],
    ),
  );
}

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  let score: SharedScore | null = null;
  if (isUuid(id)) {
    try {
      score = await supabaseRepository().getShared(id);
    } catch (err) {
      logError('og_lookup_failed', { id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  const svg = await satori(card(score) as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Lilita One', data: await font, weight: 400, style: 'normal' }],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // Scores are immutable, so a found card can be cached forever; the fallback card briefly.
      'cache-control': score ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  });
}
