import { z } from "zod";
import { serve, body, requireUser, quota } from "../_shared/http.ts";
import { meaningSearch } from "../_shared/ai/meaning-search.ts";
serve(async (req) => {
  const { db, user } = await requireUser(req);
  const data = z
    .object({
      query: z.string().trim().min(2).max(500),
      mine: z.boolean().default(true),
    })
    .parse(await body(req));
  await quota(db, user.id);
  return await meaningSearch(db, user.id, data.query, data.mine);
});
