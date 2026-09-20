"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Participant {
  username: string;
  avatar_url: string;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  other_participant: Participant;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages?: Message[];
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch("/api/messages/", {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          setAuthError(true);
          return;
        }
        const data = await res.json();
        setConversations(data.results ?? data);
      } catch {
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, []);

  useEffect(() => {
    if (authError) router.push("/auth/login");
  }, [authError, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, conversations]);

  const selected = conversations.find((c) => c.id === selectedId);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${selectedId}/send/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputValue.trim() }),
      });
      if (res.ok) {
        const msg: Message = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? { ...c, messages: [...(c.messages ?? []), msg], last_message: msg.content, last_message_time: msg.created_at }
              : c
          )
        );
        setInputValue("");
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-muted">Loading...</p>
      </div>
    );
  }

  if (authError) return null;

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ggz-text-primary mb-6">
        Messages
      </h1>

      <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] overflow-hidden flex h-[70vh]">
        {/* Sidebar */}
        <div className="w-80 border-r border-ggz-border flex flex-col overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-ggz-text-muted">No conversations yet.</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left border-b border-ggz-border transition ${
                  selectedId === conv.id
                    ? "bg-ggz-amber/10 border-l-2 border-l-ggz-amber"
                    : "hover:bg-ggz-bg-2"
                }`}
              >
                <Image
                  src={conv.other_participant.avatar}
                  alt={conv.other_participant.username}
                  className="w-9 h-9 rounded-full bg-ggz-border object-cover shrink-0"
                  fill
                  sizes="36px"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ggz-text-primary truncate">
                      {conv.other_participant.username}
                    </span>
                    <span className="text-[11px] text-ggz-text-muted whitespace-nowrap ml-2">
                      {new Date(conv.last_message_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ggz-text-muted truncate">
                      {conv.last_message}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 shrink-0 bg-ggz-amber text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Message area */}
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(selected.messages ?? []).map((msg) => (
                  <div key={msg.id} className="max-w-[75%]">
                    <span className="text-xs font-semibold text-ggz-text-primary block mb-0.5">
                      {msg.sender}
                    </span>
                    <div className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] px-3 py-2">
                      <p className="text-sm text-ggz-text-secondary whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                    <span className="text-[10px] text-ggz-text-muted mt-0.5 block">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={handleSend}
                className="border-t border-ggz-border p-3 flex gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-lg)] px-4 py-2 text-sm text-ggz-text-primary placeholder:text-ggz-text-muted focus:outline-none focus:border-ggz-amber"
                />
                <button
                  type="submit"
                  disabled={sending || !inputValue.trim()}
                  className="bg-ggz-amber text-black font-semibold px-5 py-2 rounded-[var(--radius-lg)] hover:opacity-90 transition disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-ggz-text-muted">
                Select a conversation to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
