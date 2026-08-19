import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the Spain trip wardrobe.");
}

const userId = "00000000-0000-4000-8000-000000000001";
const seedMarker = "Spain trip checklist fixture";

const tripItems = [
  {
    slug: "white-t-shirt",
    name: "White T-shirt",
    category: "top",
    colors: ["white"],
    pattern: "solid",
    formality: 1,
    season: ["spring", "summer"],
    material: "cotton",
    fit: "regular",
    swatch: "#f7f4ec",
    accent: "#d8d5cc",
  },
  {
    slug: "cream-t-shirt",
    name: "White / cream T-shirt",
    category: "top",
    colors: ["cream", "white"],
    pattern: "solid",
    formality: 1,
    season: ["spring", "summer"],
    material: "cotton",
    fit: "relaxed",
    swatch: "#eee3c7",
    accent: "#d6c8a7",
  },
  {
    slug: "black-t-shirt",
    name: "Black T-shirt",
    category: "top",
    colors: ["black"],
    pattern: "solid",
    formality: 1,
    season: ["spring", "summer", "fall"],
    material: "cotton",
    fit: "regular",
    swatch: "#191919",
    accent: "#373737",
  },
  {
    slug: "dark-t-shirt",
    name: "Black / dark T-shirt",
    category: "top",
    colors: ["charcoal", "black"],
    pattern: "solid",
    formality: 1,
    season: ["spring", "summer", "fall"],
    material: "cotton",
    fit: "slim",
    swatch: "#30343b",
    accent: "#17191d",
  },
  {
    slug: "olive-t-shirt",
    name: "Grey / navy / olive T-shirt",
    category: "top",
    colors: ["olive"],
    pattern: "solid",
    formality: 1,
    season: ["spring", "summer", "fall"],
    material: "cotton",
    fit: "regular",
    swatch: "#687052",
    accent: "#4f563d",
  },
  {
    slug: "light-linen-shirt",
    name: "Light linen / linen-blend shirt",
    category: "top",
    colors: ["light blue", "white"],
    pattern: "solid",
    formality: 3,
    season: ["spring", "summer"],
    material: "linen blend",
    fit: "relaxed",
    swatch: "#cbdde0",
    accent: "#a9c5ca",
  },
  {
    slug: "dark-camp-collar-shirt",
    name: "Dark nice shirt / camp collar",
    category: "top",
    colors: ["navy"],
    pattern: "solid",
    formality: 3,
    season: ["spring", "summer", "fall"],
    material: "viscose blend",
    fit: "relaxed",
    swatch: "#182d47",
    accent: "#294768",
  },
  {
    slug: "beige-stone-shorts",
    name: "Beige / stone shorts",
    category: "bottom",
    colors: ["beige", "stone"],
    pattern: "solid",
    formality: 2,
    season: ["spring", "summer"],
    material: "cotton blend",
    fit: "regular",
    swatch: "#c8b99f",
    accent: "#aa987b",
  },
  {
    slug: "clean-black-shorts",
    name: "Clean black shorts",
    category: "bottom",
    colors: ["black"],
    pattern: "solid",
    formality: 2,
    season: ["spring", "summer"],
    material: "cotton blend",
    fit: "tailored",
    swatch: "#202124",
    accent: "#3b3d42",
  },
  {
    slug: "olive-navy-shorts",
    name: "Olive / navy shorts",
    category: "bottom",
    colors: ["olive"],
    pattern: "solid",
    formality: 2,
    season: ["spring", "summer"],
    material: "cotton twill",
    fit: "regular",
    swatch: "#596047",
    accent: "#414735",
  },
  {
    slug: "lightweight-trousers",
    name: "Black / navy lightweight trousers",
    category: "bottom",
    colors: ["navy"],
    pattern: "solid",
    formality: 3,
    season: ["spring", "summer", "fall"],
    material: "lightweight cotton blend",
    fit: "tapered",
    swatch: "#1e3048",
    accent: "#122238",
  },
  {
    slug: "casual-jeans",
    name: "Jeans or second casual trouser",
    category: "bottom",
    colors: ["blue"],
    pattern: "solid",
    formality: 2,
    season: ["spring", "fall", "winter"],
    material: "denim",
    fit: "straight",
    swatch: "#59758e",
    accent: "#3e5b74",
  },
  {
    slug: "black-swim-shorts",
    name: "Black swim shorts",
    category: "bottom",
    colors: ["black"],
    pattern: "solid",
    formality: 1,
    season: ["summer"],
    material: "quick-dry nylon",
    fit: "regular",
    swatch: "#17191c",
    accent: "#34373d",
  },
  {
    slug: "second-swim-shorts",
    name: "Second swim shorts",
    category: "bottom",
    colors: ["teal", "navy"],
    pattern: "striped",
    formality: 1,
    season: ["summer"],
    material: "quick-dry polyester",
    fit: "regular",
    swatch: "#277c7c",
    accent: "#173e58",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function thumbnail(item) {
  const garment =
    item.category === "top"
      ? `<path d="M115 116 170 84h60l55 32-26 53-29-15v151H170V154l-29 15z" fill="${item.swatch}" stroke="${item.accent}" stroke-width="7" stroke-linejoin="round"/>`
      : `<path d="M158 86h84l15 218h-63l-5-108-5 108h-63l15-218z" fill="${item.swatch}" stroke="${item.accent}" stroke-width="7" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(item.name)}</title>
  <desc id="desc">Fixture illustration for the Spain trip wardrobe</desc>
  <rect width="400" height="500" rx="36" fill="#f2eee4"/>
  <circle cx="200" cy="192" r="139" fill="#fff" opacity=".7"/>
  ${garment}
  <text x="200" y="394" text-anchor="middle" fill="#123c32" font-family="system-ui, sans-serif" font-size="20" font-weight="700">${escapeXml(item.name)}</text>
  <text x="200" y="426" text-anchor="middle" fill="#547169" font-family="system-ui, sans-serif" font-size="14">SPAIN TRIP · ${item.category.toUpperCase()}</text>
</svg>`;
}

const uploadDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "spain-trip",
);
await mkdir(uploadDirectory, { recursive: true });

const sql = postgres(databaseUrl, { max: 1 });

try {
  let inserted = 0;
  let skipped = 0;

  for (const item of tripItems) {
    await writeFile(
      path.join(uploadDirectory, `${item.slug}.svg`),
      thumbnail(item),
      "utf8",
    );

    const existing = await sql`
      select id
      from items
      where user_id = ${userId}
        and name = ${item.name}
        and notes = ${seedMarker}
      limit 1
    `;

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await sql`
      insert into items (
        user_id,
        image_url,
        name,
        category,
        colors,
        pattern,
        formality,
        season,
        material,
        fit,
        notes,
        available
      ) values (
        ${userId},
        ${`/uploads/spain-trip/${item.slug}.svg`},
        ${item.name},
        ${item.category},
        ${item.colors},
        ${item.pattern},
        ${item.formality},
        ${item.season},
        ${item.material},
        ${item.fit},
        ${seedMarker},
        true
      )
    `;
    inserted += 1;
  }

  console.log(
    `Spain trip wardrobe ready: ${inserted} inserted, ${skipped} already present.`,
  );
} finally {
  await sql.end();
}
