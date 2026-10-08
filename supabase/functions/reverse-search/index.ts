import { z } from "zod";
import { serve, body, requireUser, quota, check } from "../_shared/http.ts";
import { aiAvailable, embedding, structured } from "../_shared/ai/client.ts";
serve(async (req) => {
  const { db, user } = await requireUser(req);
  const data = z
    .object({
      query: z.string().trim().min(2).max(500),
      mine: z.boolean().default(true),
    })
    .parse(await body(req));
  await quota(db, user.id);
  const vector = aiAvailable() ? await embedding(data.query) : null;
  const results = check(
    await db.rpc("hybrid_search", {
      p_user: user.id,
      p_query: data.query,
      p_embedding: vector,
      p_mine: data.mine,
    }),
  );
  let explanation = "";
  if (results?.length && aiAvailable()) {
    const response = await structured(
      z.object({ explanation: z.string().max(1800) }),
      "Explain the distinctions between the supplied vocabulary results in a few useful sentences. Say when matches are approximate. Do not invent personal history or words absent from the results.",
      { query: data.query, results },
    );
    explanation = response.explanation;
  }
  return { results, explanation, mode: vector ? "hybrid" : "text" };
});
