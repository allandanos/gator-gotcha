/**
 * Renders the PWA / home-screen icons from a hand-drawn SVG badge.
 * Run with `npx tsx scripts/make-icons.ts`; the PNGs are committed under public/icons.
 */
import { writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const INK = '#24331c';

/** A gator peeking out of the swamp, eyeing an egg. `inset` shrinks the art for maskable safe zones. */
function badge(inset: number, rounded: boolean): string {
  const s = 1 - inset * 2;
  const t = 512 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${rounded ? 112 : 0}"/></clipPath></defs>
  <g clip-path="url(#c)">
  <rect width="512" height="512" fill="#2f9fc4"/>
  <path d="M0 ${t + 340 * s} Q128 ${t + 312 * s} 256 ${t + 340 * s} T512 ${t + 340 * s} V512 H0 Z" fill="#4cc3e0"/>
  </g>
  <g transform="translate(${t} ${t}) scale(${s})" stroke="${INK}" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">
    <ellipse cx="420" cy="120" rx="44" ry="56" fill="#fff8e7" transform="rotate(14 420 120)"/>
    <ellipse cx="408" cy="104" rx="11" ry="16" fill="#ffd84d" stroke="none"/>
    <path d="M60 352 C60 250 120 205 210 205 L360 230 C400 238 410 262 396 286 C380 312 330 318 300 322 L60 360 Z" fill="#4fae5a"/>
    <path d="M150 300 L170 322 L190 300 L210 322 L230 300 L250 320" fill="none" stroke="#fffdf5" stroke-width="10"/>
    <circle cx="150" cy="190" r="48" fill="#4fae5a"/>
    <circle cx="232" cy="196" r="44" fill="#4fae5a"/>
    <circle cx="160" cy="186" r="24" fill="#fffdf5" stroke-width="10"/>
    <circle cx="238" cy="192" r="22" fill="#fffdf5" stroke-width="10"/>
    <circle cx="170" cy="188" r="10" fill="${INK}" stroke="none"/>
    <circle cx="246" cy="194" r="10" fill="${INK}" stroke="none"/>
    <circle cx="340" cy="244" r="6" fill="${INK}" stroke="none"/>
    <path d="M30 366 Q140 340 250 366 T470 366" fill="none" stroke="#fffdf5" stroke-width="12" opacity="0.8"/>
  </g>
</svg>`;
}

async function png(svg: string, size: number, file: string): Promise<void> {
  const out = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`../public/icons/${file}`, import.meta.url), out);
}

await Promise.all([
  png(badge(0.04, true), 192, 'icon-192.png'),
  png(badge(0.04, true), 512, 'icon-512.png'),
  // Maskable icons get cropped to a circle or squircle: full-bleed background, art inside the 80% safe zone.
  png(badge(0.12, false), 512, 'maskable-512.png'),
  // iOS rounds the corners itself.
  png(badge(0.06, false), 180, 'apple-touch-icon.png'),
]);
