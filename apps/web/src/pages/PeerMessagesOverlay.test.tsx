// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PeerMessagesOverlay } from "./PeerMessagesOverlay";

const query = vi.hoisted(() => ({
  data: undefined as
    | undefined
    | Array<{
        id: string;
        createdAt: string;
        blocks: Array<{
          kind: "bot_message_sent";
          toBotId: string;
          toBotName: string;
          text: string;
        }>;
      }>,
  isFetching: true,
  isError: false,
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => query }));
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({ threads: { messages: { queryKey: () => ["messages"] } } }),
}));
vi.mock("../lib/rpc", () => ({ rpc: {} }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings.join("") }),
}));
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Container,
    DialogContent: Container,
    DialogTitle: Container,
    DialogClose: Container,
    Button: Container,
    BotAvatar: () => null,
    Spinner: () => null,
  };
});

afterEach(() => {
  query.data = undefined;
  query.isFetching = true;
  vi.unstubAllGlobals();
});

it.each([false, true])("opens %s cached peer history at the latest message", async (cached) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  const messages = Array.from({ length: 100 }, (_, index) => ({
    id: `message-${index}`,
    createdAt: "2026-01-01T00:00:00Z",
    blocks: [
      {
        kind: "bot_message_sent" as const,
        toBotId: "peer",
        toBotName: "Peer",
        text: `Entry ${index}`,
      },
    ],
  }));
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = () =>
    root.render(
      <PeerMessagesOverlay
        botId="bot"
        botName="Bot"
        botColor=""
        peerBotId="peer"
        peerBotName="Peer"
        peerBotColor=""
        onClose={() => {}}
      />,
    );
  try {
    if (cached) query.data = messages;
    await act(render);
    if (!cached) {
      expect(host.querySelector('[data-testid="peer-conversation-transcript"]')).toBeNull();
      query.data = messages;
      query.isFetching = false;
      await act(render);
    }
    const transcript = host.querySelector<HTMLDivElement>(
      '[data-testid="peer-conversation-transcript"]',
    )!;
    Object.defineProperty(transcript, "scrollHeight", { value: 10_000 });
    expect(transcript.scrollTop).toBe(0);
    await act(() =>
      frames.splice(0).forEach((frame) => {
        frame(0);
      }),
    );
    expect(transcript.scrollTop).toBe(10_000);
    expect(transcript.lastElementChild?.textContent).toContain("Entry 99");
    transcript.scrollTop = 500;
    await act(render);
    await act(() =>
      frames.splice(0).forEach((frame) => {
        frame(0);
      }),
    );
    expect(transcript.scrollTop).toBe(500);
  } finally {
    await act(() => root.unmount());
  }
});
