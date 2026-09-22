"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Participant {
  id: number | null;
  username?: string | null;
  gamer_tag?: string | null;
  avatar?: string | null;
}

interface Message {
  id: number;
  sender: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

interface Conversation {
  id: number;
  other_participant?: Participant | null;
  participants?: Participant[];
  last_message: string;
  last_message_time: string;
  unread_count: number;
  updated_at: string;
  messages?: Message[];
}

function displayParticipant(conversation: Conversation): Participant {
  if (conversation.other_participant) return conversation.other_participant;
  const first = (conversation.participants ?? [])[0];
  if (first) return first;
  return { id: null, username: null, gamer_tag: "Gamer", avatar: null };
}

function getCsrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function MessagesPage() {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState("");

  useEffect(() => {
    fetch("/api/messages/", { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results ?? [];
        setConversations(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    fetch("/api/messages/" + selectedId + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) throw new Error("Conversation unavailable");
        return res.json();
      })
      .then((detail) => {
        if (!cancelled && detail) {
          setConversations((items) =>
            items.map((item) => item.id === selectedId ? { ...item, ...detail, messages: detail.messages ?? [] } : item)
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, conversations.find((item) => item.id === selectedId)?.messages?.length]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = composer.trim();
    if (!content || selectedId == null || sending) return;
    setSending(true);
    try {
      if (!getCsrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/messages/" + selectedId + "/send/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Message failed");
      const message: Message = await res.json();
      setConversations((items) => items.map((item) =>
        item.id === selectedId
          ? { ...item, last_message: message.content, last_message_time: message.created_at, messages: [...(item.messages ?? []), message], unread_count: 0 }
          : item
      ));
      setComposer("");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-8 text-ggz-text-secondary">Loading messages…</div>;

  const selected = conversations.find((item) => item.id === selectedId);
  const selectedOther = selected ? displayParticipant(selected) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Direct chat</p>
        <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Messages</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1 lg:grid lg:grid-cols-[320px_1fr]">
        <aside className={"border-r border-ggz-border " + (selected ? "hidden lg:block" : "block")}>
          <div className="border-b border-ggz-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">{conversations.length} conversations</div>
          <div className="max-h-[68vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-sm text-ggz-text-secondary">No conversations yet. Open a gamer profile to start a conversation.</div>
            ) : conversations.map((conversation) => {
              const other = displayParticipant(conversation);
              return (
              <button key={conversation.id} onClick={() => { setDetailLoading(true); setSelectedId(conversation.id); }} className={"flex w-full items-center gap-3 border-b border-ggz-border/70 px-4 py-3 text-left transition " + (selectedId === conversation.id ? "bg-ggz-amber/10" : "hover:bg-ggz-bg-2")}>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                  {other.avatar ? <Image src={other.avatar} alt="" fill sizes="40px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{(other.gamer_tag || "G").slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ggz-text-primary">{other.gamer_tag || other.username || "Gamer"}</p>
                    {conversation.unread_count > 0 && <span className="rounded-full bg-ggz-amber px-2 py-0.5 text-[10px] font-bold text-black">{conversation.unread_count}</span>}
                  </div>
                  <p className="truncate text-xs text-ggz-text-muted">{conversation.last_message || "No messages yet"}</p>
                </div>
              </button>
              );
            })}
          </div>
        </aside>

        <section className={"min-h-[62vh] " + (selected ? "block" : "hidden lg:block")}>
          {selected ? (
            <div className="flex h-full min-h-[62vh] flex-col">
              <div className="flex items-center gap-3 border-b border-ggz-border px-4 py-3">
                <button onClick={() => setSelectedId(null)} className="lg:hidden rounded-lg border border-ggz-border px-2 py-1 text-xs text-ggz-text-secondary">Back</button>
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                  {selectedOther && selectedOther.avatar ? <Image src={selectedOther.avatar} alt="" fill sizes="36px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{((selectedOther && (selectedOther.gamer_tag || selectedOther.username)) || "G").slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ggz-text-primary">{(selectedOther && (selectedOther.gamer_tag || selectedOther.username)) || "Gamer"}</p>
                  <p className="text-xs text-ggz-text-muted">GGz conversation</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-5">
                {detailLoading ? (
                  <p className="text-sm text-ggz-text-secondary">Loading conversation…</p>
                ) : (selected.messages ?? []).length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center text-center">
                    <div><p className="font-semibold text-ggz-text-primary">Start the conversation</p><p className="mt-1 text-sm text-ggz-text-secondary">Send a message to get things going.</p></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(selected.messages ?? []).map((message) => (
                      <div key={message.id} className="max-w-[82%] rounded-2xl border border-ggz-border bg-ggz-bg-2 px-4 py-3">
                        <p className="text-xs font-semibold text-ggz-amber">{message.sender}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ggz-text-secondary">{message.content}</p>
                        <p className="mt-2 text-[10px] text-ggz-text-muted">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-ggz-border p-3">
                <div className="flex gap-2">
                  <input value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-3 text-sm text-ggz-text-primary outline-none transition focus:border-ggz-amber" />
                  <button type="submit" disabled={sending || !composer.trim()} className="rounded-xl bg-ggz-amber px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40">{sending ? "Sending…" : "Send"}</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex min-h-[62vh] items-center justify-center text-sm text-ggz-text-secondary">Select a conversation.</div>
          )}
        </section>
      </div>
    </div>
  );
}
