import { insert, list, database } from "../src/lib/server/db";
if (process.env.VERCEL || !process.env.GGZ_LOCAL_DATABASE)
  throw new Error("Local development seed only.");
if ((await list("game")).length === 0) {
  for (const [name, genre, platform, developer] of [
    ["EA SPORTS FC 26", "Sports", "PC, PlayStation, Xbox", "EA Sports"],
    ["Tekken 8", "Fighting", "PC, PlayStation, Xbox", "Bandai Namco"],
    ["Call of Duty: Mobile", "Shooter", "Mobile", "TiMi Studio"],
    ["Valorant", "Shooter", "PC", "Riot Games"],
    [
      "Mortal Kombat 1",
      "Fighting",
      "PC, PlayStation, Xbox, Nintendo",
      "NetherRealm",
    ],
    ["Rocket League", "Sports", "PC, PlayStation, Xbox, Nintendo", "Psyonix"],
  ])
    await insert("game", {
      name,
      genre,
      platform,
      developer,
      description: `Find Zimbabwean ${name} players, host a tournament and build your squad.`,
      cover_art_url: null,
      release_year: null,
      igdb_rating: null,
      player_count: 0,
      featured: true,
      free_to_play: false,
    });
}
console.log(
  "Local game catalogue ready. No fictional players or events were created.",
);
await (await database()).destroy();
