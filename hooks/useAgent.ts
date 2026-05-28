"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentMessage } from "@/types";

interface ToolEvent {
  tool: string;
  tool_id: string;
  data?: Record<string, unknown>;
}

export function useAgent(wallet: string | null) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (isStreaming || !userText.trim()) return;

      const userMsg: AgentMessage = {
        role: "trainer",
        content: userText,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsStreaming(true);
      setActiveTools([]);

      // Placeholder for Oak's response
      const oakPlaceholder: AgentMessage = {
        role: "oak",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, oakPlaceholder]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            wallet,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) throw new Error("Agent request failed");
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let oakContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "delta") {
                oakContent += event.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: oakContent,
                  };
                  return updated;
                });
              } else if (event.type === "tool_start") {
                setActiveTools((prev) => [...prev, event.tool]);
              } else if (event.type === "tool_result") {
                setActiveTools((prev) =>
                  prev.filter((t) => t !== event.tool)
                );
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    tool_used: event.tool,
                    tool_result: event.data,
                  };
                  return updated;
                });
              } else if (event.type === "done") {
                break;
              }
            } catch {}
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content:
                "Hmm… something went wrong in my lab. Try again, Trainer.",
            };
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        setActiveTools([]);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, wallet]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, activeTools, sendMessage, clearMessages, stop };
}
