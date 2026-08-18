import { z } from 'zod';

export const ATTRIBUTE_KEYS = ['adventure', 'nature', 'culture', 'food', 'history', 'urban', 'novelty', 'physicalIntensity'] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export const attributesSchema = z.object(Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, z.number().int().min(0).max(5)])) as Record<AttributeKey, z.ZodNumber>);
export const localMediaPathSchema = z.string().regex(/^\/media\/(?:cards|destinations)\/[a-z0-9/_-]+\.webp$/, 'Media must be a local opaque or destination-gallery path.');
export const photoCreditSchema = z.object({ path: localMediaPathSchema, sourceUrl: z.string().url().refine((value) => value.startsWith('https://images.unsplash.com/') || value.startsWith('https://unsplash.com/photos/'), 'Photo source must be Unsplash.'), photographerName: z.string().min(1), photographerUrl: z.string().url(), alt: z.string().min(12) });
export const coordinatesSchema = z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90) });
export const activitySchema = z.object({ id: z.string().min(1), destinationId: z.string().min(1), title: z.string().min(1), description: z.string().min(1), imageUrl: z.string().nullable().optional(), attributes: attributesSchema });
export const destinationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), country: z.string().min(1), tagline: z.string().min(1), imageUrl: localMediaPathSchema, coordinates: coordinatesSchema, gallery: z.array(photoCreditSchema).length(3), airfare: z.record(z.number()).optional(), travelFriction: z.number().int().min(0).max(5), novemberWeather: z.string().min(1) });
export type Activity = z.infer<typeof activitySchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type Attributes = z.infer<typeof attributesSchema>;
export const comparisonSchema = z.object({ activityA: z.string().min(1), activityB: z.string().min(1), winner: z.string().min(1), reason: z.string().optional() }).superRefine((value, ctx) => { if (value.activityA === value.activityB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activities must differ' }); if (value.winner !== value.activityA && value.winner !== value.activityB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Winner must be offered' }); });
export type Comparison = z.infer<typeof comparisonSchema>;
export type SafeActivity = Pick<Activity, 'id' | 'title' | 'description' | 'imageUrl'>;
export const toSafeActivity = ({ id, title, description, imageUrl }: Activity): SafeActivity => ({ id, title, description, imageUrl });
export type AtlasDestination = Pick<Destination, 'id' | 'name' | 'country' | 'tagline' | 'novemberWeather' | 'travelFriction' | 'coordinates' | 'gallery'>;
export const toAtlasDestination = ({ id, name, country, tagline, novemberWeather, travelFriction, coordinates, gallery }: Destination): AtlasDestination => ({ id, name, country, tagline, novemberWeather, travelFriction, coordinates, gallery });
