import { NextRequest } from "next/server";
import { verifyJwt } from "@/lib/auth";
import { AGENT_TOOLS, executeTool } from "@/lib/agentTools";
import { assignPokemon, POKEMON } from "@/lib/pokemon";

const BANKR_URL = "https://llm.bankr.bot/v1/chat/completions";
const BANKR_KEY = process.env.BANKR_API_KEY!;
const MODEL     = "claude-sonnet-4.6"; // rápido y barato

const OAK_SYSTEM = `You are Professor Oak, the legendary Pokémon researcher — now living in the world of Web3 on Base L2.

You speak with wisdom, warmth, and old-man excitement about crypto. Call the user "Trainer". Use occasional Pokémon references naturally. Be concise — 2-4 sentences unless showing data tables.

You have tools to read real on-chain data. Always use them before answering questions about balances, prices, rankings, or vault status. Never make up numbers.

Token: $PKMN on Base L2.`;

// Convert to OpenAI function-calling format
const OPENAI_TOOLS = AGENT_TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

export async function POST(req: NextRequest) {
  // Auth — wallet from JWT or body
  const token =
    req.cookies.get("pkmn_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");
  let wallet: string | null = null;
  if (token) wallet = await verifyJwt(token);

  const { messages, wallet: bodyWallet } = await req.json();
  const activeWallet = wallet ?? bodyWallet ?? null;

  // System prompt with trainer context
  let system = OAK_SYSTEM;
  if (activeWallet) {
    const pk = POKEMON[assignPokemon(activeWallet)];
    system += `\n\nTrainer wallet: ${activeWallet}`;
    system += `\nPokémon: ${pk?.name ?? "Unknown"} (${pk?.type ?? "?"} type) — "${pk?.role ?? ""}"`;
  }

  const chatMessages = [
    { role: "system", content: system },
    ...(messages as { role: string; content: string }[]).map((m) => ({
      role: m.role === "oak" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        let currentMessages = [...chatMessages];

        for (let i = 0; i < 5; i++) {
          // ── Call Bankr with real streaming ───────────────────────────────
          const res = await fetch(BANKR_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": BANKR_KEY,
            },
            body: JSON.stringify({
              model: MODEL,
              messages: currentMessages,
              tools: OPENAI_TOOLS,
              tool_choice: "auto",
              stream: true,
              max_tokens: 1024,
            }),
          });

          if (!res.ok) {
            throw new Error(`Bankr ${res.status}: ${await res.text()}`);
          }

          // ── Parse SSE chunks ─────────────────────────────────────────────
          const reader   = res.body!.getReader();
          const dec      = new TextDecoder();
          let buf        = "";
          let fullText   = "";
          let toolCalls: Record<string, { name: string; args: string; signaled?: boolean }> = {};
          let finishReason = "";

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (raw === "[DONE]") { finishReason = finishReason || "stop"; break outer; }

              try {
                const chunk = JSON.parse(raw);
                const delta  = chunk.choices?.[0]?.delta;
                const reason = chunk.choices?.[0]?.finish_reason;
                if (reason) finishReason = reason;

                // Text — stream word by word in real time
                if (delta?.content) {
                  fullText += delta.content;
                  send({ type: "delta", text: delta.content });
                }

                // Tool calls — accumulate arguments across chunks
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const key = String(tc.index ?? 0);
                    if (!toolCalls[key]) toolCalls[key] = { name: "", args: "" };
                    if (tc.function?.name) toolCalls[key].name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[key].args += tc.function.arguments;
                    // Signal tool start once we have the name
                    if (!toolCalls[key].signaled && toolCalls[key].name) {
                      toolCalls[key].signaled = true;
                      send({ type: "tool_start", tool: toolCalls[key].name, tool_id: key });
                    }
                  }
                }
              } catch {}
            }
          }

          // ── No tool calls → finished ─────────────────────────────────────
          const toolList = Object.entries(toolCalls);
          if (toolList.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          // ── Execute tools ────────────────────────────────────────────────
          const assistantMsg: any = {
            role: "assistant",
            content: fullText || null,
            tool_calls: toolList.map(([key, tc]) => ({
              id: `call_${key}`,
              type: "function",
              function: { name: tc.name, arguments: tc.args },
            })),
          };

          const toolResults: any[] = [];
          for (const [key, tc] of toolList) {
            let input: Record<string, unknown> = {};
            try { input = JSON.parse(tc.args); } catch {}

            let result: Record<string, unknown>;
            try { result = await executeTool(tc.name, input); }
            catch (e: any) { result = { error: e?.message ?? "Tool failed" }; }

            send({ type: "tool_result", tool: tc.name, tool_id: key, data: result });
            toolResults.push({
              role: "tool",
              tool_call_id: `call_${key}`,
              content: JSON.stringify(result),
            });
          }

          // Continue agentic loop
          currentMessages = [...currentMessages, assistantMsg, ...toolResults];
          toolCalls = {};
        }

        send({ type: "done" });
        controller.close();
      } catch (e: any) {
        send({ type: "error", message: e?.message ?? "Agent error" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
