import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  structured: vi.fn(),
  tool: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/ai/client.ts", () => ({
  aiRequest: mocks.request,
  structured: mocks.structured,
  model: () => "gemini-2.5-flash",
}));
vi.mock("../supabase/functions/_shared/ai/tools.ts", () => ({
  tools: [],
  executeTool: mocks.tool,
}));
import { tutor } from "../supabase/functions/_shared/ai/orchestrator";
it("acknowledges all Google tool calls while executing only three per round", async () => {
  const calls = Array.from({ length: 4 }, (_, i) => ({
    id: `call-${i}`,
    type: "function",
    function: { name: "get_word", arguments: '{"query":"miser","note":null}' },
  }));
  mocks.request
    .mockResolvedValueOnce({
      choices: [
        { message: { role: "assistant", content: null, tool_calls: calls } },
      ],
    })
    .mockResolvedValueOnce({
      choices: [
        { message: { role: "assistant", content: "Here is the explanation." } },
      ],
    });
  mocks.tool.mockResolvedValue({ word: "miser" });
  mocks.structured.mockResolvedValue({
    message: "A person who hoards money.",
    suggestions: [],
    exercise: null,
  });
  const reply = await tutor({} as any, "owner", [
    { role: "user", content: "Explain miser" },
  ]);
  expect(reply.exercise).toBeNull();
  expect(mocks.tool).toHaveBeenCalledTimes(3);
  expect(mocks.tool.mock.calls.every((args) => args[1] === "owner")).toBe(true);
  const messages = mocks.request.mock.calls[1][1].messages;
  expect(
    messages
      .filter((m: any) => m.role === "tool")
      .map((m: any) => m.tool_call_id),
  ).toEqual(calls.map((c) => c.id));
  expect(
    messages.find((m: any) => m.tool_call_id === "call-3").content,
  ).toContain("Tool limit reached");
});
