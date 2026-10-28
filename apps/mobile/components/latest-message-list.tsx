import type { Ref } from "react";
import type { FlatListProps } from "react-native";
import { FlatList } from "react-native";

const latestMessagePosition = { minIndexForVisible: 0, autoscrollToTopThreshold: 80 };

/** Newest-first data keeps the latest message at the bottom and older rows above it. */
export function LatestMessageList<T>({
  ref,
  ...props
}: Omit<FlatListProps<T>, "inverted" | "maintainVisibleContentPosition"> & {
  ref?: Ref<FlatList<T>>;
}) {
  return (
    <FlatList
      {...props}
      ref={ref}
      inverted
      maintainVisibleContentPosition={latestMessagePosition}
    />
  );
}
