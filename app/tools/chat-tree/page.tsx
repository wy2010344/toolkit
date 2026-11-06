import type { Metadata } from "next";
import { ChatTreeApp } from "@/components/chat-tree/ChatTreeApp";

export const metadata: Metadata = {
  title: "对话树 · 追问回溯",
  description: "把每一次提问画成树上的节点：分支追加、单条追问链回溯、图可缩放平移，点节点在右侧看回答。",
};

export default function ChatTreePage() {
  return <ChatTreeApp />;
}
