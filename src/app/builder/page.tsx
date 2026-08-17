import { OutfitBuilder } from "@/app/builder/outfit-builder";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string | string[] }>;
}) {
  const rawItems = (await searchParams).items;
  const initialItemIds = (Array.isArray(rawItems) ? rawItems[0] : rawItems)
    ?.split(",")
    .slice(0, 5);

  return <OutfitBuilder initialItemIds={initialItemIds ?? []} />;
}
