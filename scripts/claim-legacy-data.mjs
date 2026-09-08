import postgres from "postgres";

const legacyUserId = "00000000-0000-4000-8000-000000000001";
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL ?? "require";
const email = process.argv[2]?.trim().toLowerCase();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to claim legacy data.");
}

if (!email) {
  throw new Error(
    "Pass the first signed-in account email: npm run db:claim-legacy -- you@example.com",
  );
}

if (!["require", "disable"].includes(databaseSsl)) {
  throw new Error("DATABASE_SSL must be either require or disable.");
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: databaseSsl === "require" ? "require" : false,
});

try {
  const result = await sql.begin(async (transaction) => {
    const [target] = await transaction`
      select id, email
      from users
      where lower(email) = ${email}
        and id <> ${legacyUserId}
      for update
    `;

    if (!target) {
      throw new Error(
        `No signed-in Better Auth user exists for ${email}. Sign in once before claiming data.`,
      );
    }

    const [legacy] = await transaction`
      select id
      from users
      where id = ${legacyUserId}
      for update
    `;

    if (!legacy) {
      throw new Error(
        "Legacy data has already been claimed or the placeholder owner is missing.",
      );
    }

    const items = await transaction`
      update items set user_id = ${target.id} where user_id = ${legacyUserId}
    `;
    const outfits = await transaction`
      update outfits set user_id = ${target.id} where user_id = ${legacyUserId}
    `;
    const images = await transaction`
      update image_objects set user_id = ${target.id} where user_id = ${legacyUserId}
    `;
    await transaction`delete from users where id = ${legacyUserId}`;

    return {
      email: target.email,
      images: images.count,
      items: items.count,
      outfits: outfits.count,
    };
  });

  console.log(
    `Claimed legacy data for ${result.email}: ${result.items} items, ${result.outfits} outfits, ${result.images} images.`,
  );
} finally {
  await sql.end();
}
