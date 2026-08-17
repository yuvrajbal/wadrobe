import { z } from "zod";

export const weatherCoordinatesSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  })
  .strict();

export const weatherResponseSchema = z
  .object({
    current: z.object({ temperature_2m: z.number() }),
  })
  .passthrough();
