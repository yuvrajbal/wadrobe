import { NextResponse } from "next/server";

import {
  weatherCoordinatesSchema,
  weatherResponseSchema,
} from "@/lib/weather-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const coordinates = weatherCoordinatesSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!coordinates.success) {
    return NextResponse.json(
      { error: "Invalid weather coordinates." },
      { status: 400 },
    );
  }

  const query = new URLSearchParams({
    latitude: String(coordinates.data.latitude),
    longitude: String(coordinates.data.longitude),
    current: "temperature_2m",
    temperature_unit: "fahrenheit",
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${query}`,
      { next: { revalidate: 900 } },
    );
    if (!response.ok) throw new Error(`Weather returned ${response.status}`);

    const weather = weatherResponseSchema.parse(await response.json());
    return NextResponse.json({
      temperature: Math.round(weather.current.temperature_2m),
      unit: "fahrenheit",
    });
  } catch (error) {
    console.error("Weather lookup failed", error);
    return NextResponse.json(
      { error: "Local weather could not be loaded. Enter it manually." },
      { status: 502 },
    );
  }
}
