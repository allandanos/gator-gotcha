import { dueHints, HINT_TEXT } from './hints';

describe('dueHints', () => {
  it('shows each tip on its first trigger and marks it seen', () => {
    const first = dueHints([{ type: 'spotted' }], 0);
    expect(first.due).toEqual([HINT_TEXT.spotted]);
    expect(dueHints([{ type: 'spotted' }], first.seen).due).toEqual([]);
  });

  it('covers the first sprint and the first egg', () => {
    const r = dueHints([{ type: 'sprintStart' }, { type: 'pickup', pos: { x: 0, y: 0 } }], 0);
    expect(r.due).toEqual([HINT_TEXT.sprintStart, HINT_TEXT.pickup]);
    expect(r.seen).toBe(0b110);
  });

  it('explains the first nightfall once', () => {
    const r = dueHints([{ type: 'nightfall' }], 0b111);
    expect(r.due).toEqual([HINT_TEXT.nightfall]);
    expect(dueHints([{ type: 'nightfall' }], r.seen).due).toEqual([]);
  });

  it('ignores other events and duplicates within one step', () => {
    const r = dueHints([{ type: 'lost' }, { type: 'spotted' }, { type: 'spotted' }], 0);
    expect(r.due).toHaveLength(1);
    expect(r.seen).toBe(0b001);
  });
});
