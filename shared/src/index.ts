import { z } from 'zod';

export const ATTRIBUTE_KEYS = ['adventure', 'nature', 'culture', 'food', 'history', 'urban', 'novelty', 'physicalIntensity'] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export const attributesSchema = z.object(Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, z.number().int().min(0).max(5)])) as Record<AttributeKey, z.ZodNumber>);
export const activitySchema = z.object({ id: z.string().min(1), destinationId: z.string().min(1), title: z.string().min(1), description: z.string().min(1), imageUrl: z.string().nullable().optional(), attributes: attributesSchema });
export const destinationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), country: z.string().min(1), tagline: z.string().min(1), imageUrl: z.string().nullable().optional(), airfare: z.record(z.number()).optional(), travelFriction: z.number().int().min(0).max(5), novemberWeather: z.string().min(1) });
export type Activity = z.infer<typeof activitySchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type Attributes = z.infer<typeof attributesSchema>;
export const comparisonSchema = z.object({ activityA: z.string().min(1), activityB: z.string().min(1), winner: z.string().min(1), reason: z.string().optional() }).superRefine((value, ctx) => { if (value.activityA === value.activityB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activities must differ' }); if (value.winner !== value.activityA && value.winner !== value.activityB) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Winner must be offered' }); });
export type Comparison = z.infer<typeof comparisonSchema>;
export type SafeActivity = Pick<Activity, 'id' | 'title' | 'description'>;
export const toSafeActivity = ({ id, title, description }: Activity): SafeActivity => ({ id, title, description });
