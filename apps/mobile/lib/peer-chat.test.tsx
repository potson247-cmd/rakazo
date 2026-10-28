// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PeerChat from "../app/peer-chat";

const list = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({
  FlatList: (props: Record<string, unknown>) => {
    list(props);
    return null;
  },
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ActivityIndicator: () => null,
  Pressable: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({
    botId: "bot",
    botName: "Bot",
    peerBotId: "peer",
    peerBotName: "Peer",
  }),
}));
vi.mock("../components/glass-title", () => ({ glassHeaderOptions: () => ({}) }));
vi.mock("./api", () => ({
  rpc: async () => ({
    messages: Array.from({ length: 100 }, (_, index) => ({
      id: `message-${index}`,
      createdAt: "2026-01-01T00:00:00Z",
      blocks: [
        { kind: "bot_message_sent", toBotId: "peer", toBotName: "Peer", text: `Entry ${index}` },
      ],
    })),
    olderCursor: null,
  }),
}));
vi.mock("./appearance", () => ({ mobileTokens: () => ({}) }));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));
vi.mock("./native", () => ({
  native: {},
  useResolvedAppearance: () => "light",
  useThemedStyles: (create: () => unknown) => create(),
}));
vi.mock("./side-insets", () => ({ useSideInsets: () => ({}) }));
vi.mock("@rakazo/chat-ui/native", () => ({ ChatMarkdown: () => null }));

it("opens peer history with the normal chat's inverted latest-message anchor", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<PeerChat />));
    const props = list.mock.lastCall?.[0];
    expect(props).toMatchObject({
      inverted: true,
      maintainVisibleContentPosition: { minIndexForVisible: 0, autoscrollToTopThreshold: 80 },
    });
    expect(props.data).toHaveLength(100);
    expect(props.data[0].text).toBe("Entry 99");
    expect(props.data[99].text).toBe("Entry 0");
  } finally {
    await act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
