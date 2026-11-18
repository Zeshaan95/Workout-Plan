/**
 * Food photo analysis with Claude: estimates each item on the plate and turns it into diary entries.
 * The request goes straight from the phone to the Anthropic API with the user's own key.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { PLAN } from '../plan';
import type { ISODate } from './dates';
import type { DiaryEntry, MealId, Nutrients } from './food';

export const PhotoItemSchema = z.object({
  name: z.string().describe('Short food name in British English, e.g. "Grilled chicken breast"'),
  portion: z.string().describe('Portion as you would describe it, e.g. "1 fillet (about 150 g)"'),
  grams: z.number().nullable().describe('Estimated weight in grams, or null for drinks or when unsure'),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fibre_g: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const PhotoResultSchema = z.object({
  is_food: z.boolean().describe('False if the photo does not show food or drink'),
  items: z.array(PhotoItemSchema),
  notes: z.string().describe('One or two short sentences on assumptions (oil, sauces, hidden items), or empty'),
});

export type PhotoItem = z.infer<typeof PhotoItemSchema>;
export type PhotoResult = z.infer<typeof PhotoResultSchema>;

export const SYSTEM_PROMPT = `You estimate the nutrition of meals from photos for a UK food diary. The person is on a fat-loss plan and relies on honest estimates.

For each separate food or drink you can see, estimate the portion and its calories, protein, carbohydrate, fat and fibre, using UK food composition values (as on UK labels, with fibre measured the AOAC way).

- Split the plate into its components (e.g. rice, chicken, sauce) rather than one combined dish, unless it is clearly a single item such as a sandwich or pizza slice.
- Judge portion size from the plate, cutlery, packaging and hands. Give grams where you can.
- Account for cooking oil, butter and sauces you can see or that the dish almost certainly contains, and say so in the notes. Do not invent items you cannot see.
- If the person adds a note (weights, ingredients, what was eaten), trust it over what the photo suggests.
- When unsure between two portion sizes, pick the more likely one and lower the confidence rather than under-estimating.
- If the photo does not show food or drink, set is_food to false and return no items.`;

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Request parameters for one photo (pure, so it can be tested). */
export function buildPhotoRequest(imageBase64: string, mediaType: ImageMediaType, note: string) {
  const cfg = PLAN.diary.photo;
  const text = note.trim() ? `Estimate the nutrition of this meal. My note: ${note.trim()}` : 'Estimate the nutrition of this meal.';
  return {
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: imageBase64 } },
          { type: 'text' as const, text },
        ],
      },
    ],
  };
}

export class PhotoAnalysisError extends Error {
  constructor(
    message: string,
    public kind: 'no-key' | 'auth' | 'rate' | 'offline' | 'refused' | 'not-food' | 'failed',
  ) {
    super(message);
  }
}

/** Send the photo to Claude and return the parsed estimate. `client` is injectable for tests. */
export async function analyseFoodPhoto(
  client: Anthropic,
  imageBase64: string,
  mediaType: ImageMediaType,
  note = '',
): Promise<PhotoResult> {
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
  try {
    const response = await client.beta.messages.parse({
      ...buildPhotoRequest(imageBase64, mediaType, note),
      output_config: { effort: PLAN.diary.photo.effort, format: betaZodOutputFormat(PhotoResultSchema) },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'refusal') throw new PhotoAnalysisError("Claude couldn't analyse this photo. Try another, or add the food by search.", 'refused');
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new PhotoAnalysisError('The estimate came back incomplete. Please try again.', 'failed');
    const result = response.parsed_output;
    if (!result.is_food || result.items.length === 0) throw new PhotoAnalysisError("That doesn't look like food. Try a clearer photo of the plate.", 'not-food');
    return result;
  } catch (e) {
    if (e instanceof PhotoAnalysisError) throw e;
    if (e instanceof AnthropicSDK.AuthenticationError || e instanceof AnthropicSDK.PermissionDeniedError) throw new PhotoAnalysisError('Your Anthropic API key was rejected. Check it in Settings.', 'auth');
    if (e instanceof AnthropicSDK.RateLimitError) throw new PhotoAnalysisError('Too many requests or out of credit. Try again shortly, or check your Anthropic billing.', 'rate');
    if (e instanceof AnthropicSDK.APIConnectionError) throw new PhotoAnalysisError('No connection. Photo analysis needs signal.', 'offline');
    if (e instanceof AnthropicSDK.APIError) throw new PhotoAnalysisError(`Analysis failed (${e.status ?? 'error'}). Please try again.`, 'failed');
    throw new PhotoAnalysisError('Analysis failed. Please try again.', 'failed');
  }
}

export async function makeClient(apiKey: string, fetchImpl?: typeof fetch): Promise<Anthropic> {
  if (!apiKey.trim()) throw new PhotoAnalysisError('Add your Anthropic API key in Settings to use photo logging.', 'no-key');
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  // The key is the user's own, kept on their device; there is no server to hide it behind.
  return new AnthropicSDK({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function itemNutrients(i: PhotoItem): Nutrients {
  return { kcal: Math.round(i.kcal), protein: r1(i.protein_g), fat: r1(i.fat_g), carbs: r1(i.carbs_g), fibre: r1(i.fibre_g) };
}

/** Reviewed items become diary entries (one serving each, nutrients as estimated). */
export function photoItemsToEntries(items: PhotoItem[], date: ISODate, meal: MealId): DiaryEntry[] {
  const now = new Date().toISOString();
  return items.map((i) => {
    const n = itemNutrients(i);
    return {
      date,
      meal,
      foodId: null,
      name: i.name.trim() || 'Photo item',
      brand: 'Photo estimate',
      serving: { label: i.portion.trim() || '1 portion', grams: i.grams, ...n },
      qty: 1,
      ...n,
      createdAt: now,
    };
  });
}
