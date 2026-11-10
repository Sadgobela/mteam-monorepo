"use client";

import { Empty } from "antd";

export function EmptyState({ text }: { text: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />;
}
