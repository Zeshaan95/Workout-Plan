import { describe, expect, it } from 'vitest';
import { analyseFoodPhoto, buildPhotoRequest, makeClient, PhotoAnalysisError, photoItemsToEntries, type PhotoItem } from './photoFood';

const item: PhotoItem = { name: 'Grilled chicken breast', portion: '1 fillet (about 150 g)', grams: 150, kcal: 222.4, protein_g: 48.04, carbs_g: 0, fat_g: 3.3, fibre_g: 0, confidence: 'medium' };

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const message = (text: string, stop_reason = 'end_turn') => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content: text ? [{ type: 'text', text }] : [], stop_reason, stop_sequence: null,
  ...(stop_reason === 'refusal' ? { stop_details: { type: 'refusal', category: null, explanation: null } } : {}),
  usage: { input_tokens: 1500, output_tokens: 200 },
});

describe('photo request', () => {
  it('sends the image first, then the note, with the plan model', () => {
    const r = buildPhotoRequest('AAAA', 'image/jpeg', ' 200 g chicken ');
    expect(r.model).toBe('claude-opus-5-5');
    expect(r.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(r.messages[0].content[1]).toEqual({ type: 'text', text: 'Estimate the nutrition of this meal. My note: 200 g chicken' });
    expect(r.system).toMatch(/UK food composition/);
  });
});

describe('photo analysis via the SDK', () => {
  it('parses the structured estimate and sends refusal fallbacks', async () => {
    const result = { is_food: true, items: [item], notes: 'Assumed 1 tsp oil.' };
    const { fn, calls } = fakeFetch(message(JSON.stringify(result)));
    const client = await makeClient('sk-ant-test', fn);
    expect(await analyseFoodPhoto(client, 'AAAA', 'image/jpeg')).toEqual(result);
    const sent = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toContain('/v1/messages');
    expect(sent.fallbacks).toBe('default');
    expect(sent.output_config.effort).toBe('medium');
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(new Headers(calls[0].init.headers).get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });
  it('turns API problems into friendly errors', async () => {
    const notFood = fakeFetch(message(JSON.stringify({ is_food: false, items: [], notes: '' })));
    await expect(analyseFoodPhoto(await makeClient('k', notFood.fn), 'A', 'image/jpeg')).rejects.toMatchObject({ kind: 'not-food' });
    const refused = fakeFetch(message('', 'refusal'));
    await expect(analyseFoodPhoto(await makeClient('k', refused.fn), 'A', 'image/jpeg')).rejects.toMatchObject({ kind: 'refused' });
    const auth = fakeFetch({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
    await expect(analyseFoodPhoto(await makeClient('k', auth.fn), 'A', 'image/jpeg')).rejects.toMatchObject({ kind: 'auth' });
    await expect(makeClient('  ')).rejects.toBeInstanceOf(PhotoAnalysisError);
  });
});

describe('photo items to diary', () => {
  it('rounds nutrients and keeps the portion as the serving', () => {
    const [e] = photoItemsToEntries([item], '2026-11-18', 'dinner');
    expect(e).toMatchObject({ date: '2026-11-18', meal: 'dinner', name: 'Grilled chicken breast', brand: 'Photo estimate', qty: 1, kcal: 222, protein: 48, fat: 3.3 });
    expect(e.serving).toMatchObject({ label: '1 fillet (about 150 g)', grams: 150, kcal: 222 });
  });
});
