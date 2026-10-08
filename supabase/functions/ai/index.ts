import { z } from "zod";
import {
  serve,
  body,
  requireUser,
  quota,
  check,
  AppError,
} from "../_shared/http.ts";
import { tutor } from "../_shared/ai/orchestrator.ts";
serve(async (req) => {
  const { db, user } = await requireUser(req);
  const data = z
    .object({
      message: z.string().trim().min(1).max(2000),
      session_id: z.string().uuid().nullable().default(null),
    })
    .parse(await body(req));
  await quota(db, user.id);
  let sessionId = data.session_id;
  if (sessionId) {
    const session = check(
      await db
        .from("ai_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!session) throw new AppError(404, "This conversation was not found.");
  } else {
    sessionId = check(
      await db
        .from("ai_sessions")
        .insert({ user_id: user.id, title: data.message.slice(0, 80) })
        .select("id")
        .single(),
    )!.id;
  }
  const history =
    check(
      await db
        .from("ai_messages")
        .select("role,content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(6),
    ) || [];
  const response = await tutor(db, user.id, [
    ...history.reverse(),
    { role: "user", content: data.message },
  ]);
  check(
    await db.from("ai_messages").insert([
      { session_id: sessionId, role: "user", content: data.message },
      {
        session_id: sessionId,
        role: "assistant",
        content: response.message,
        structured_content: response,
      },
    ]),
  );
  check(
    await db
      .from("ai_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", user.id),
  );
  return { session_id: sessionId, ...response };
});
