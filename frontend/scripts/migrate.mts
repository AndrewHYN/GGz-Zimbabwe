import { migrate } from "../src/lib/server/schema";
import { database } from "../src/lib/server/db";
await migrate();
console.log(
  "GGz additive schema migration complete. Legacy Django tables were not changed.",
);
await (await database()).destroy();
