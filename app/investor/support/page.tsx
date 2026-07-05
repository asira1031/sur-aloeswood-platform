"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, statusClass, type AnyRow } from "@/app/lib/settings/preferences";

const quickPrompts = [
  "How do I cash in?",
  "Where can I see my AG trees?",
  "How do certificates work?",
  "I need admin help",
];

type TabMode = "CHAT" | "TICKETS" | "HISTORY";

export default function InvestorSupportPage() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AnyRow | null>(null);
  const [chats, setChats] = useState<AnyRow[]>([]);
  const [messages, setMessages] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [tab, setTab] = useState<TabMode>("CHAT");
  const [draft, setDraft] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sur_login_email") || "";
    setEmail(saved);
    if (saved) loadSupport(saved);
  }, []);

  async function loadSupport(targetEmail = email) {
    setNotice("");
    const cleanEmail = targetEmail.toLowerCase().trim();

    if (!cleanEmail) {
      setNotice("Login first to open support chat.");
      return;
    }

    setLoading(true);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_status, kyc_status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profileError || !profileRow) {
      setNotice(profileError?.message || "Profile not found.");
      setProfile(null);
      setLoading(false);
      return;
    }

    const [{ data: chatRows, error: chatError }, { data: ticketRows }] = await Promise.all([
      supabase.from("support_chats").select("*").eq("profile_id", profileRow.id).order("updated_at", { ascending: false }),
      supabase.from("support_tickets").select("*").eq("profile_id", profileRow.id).order("created_at", { ascending: false }),
    ]);

    if (chatError) {
      setNotice(`${chatError.message}. Run the support chat SQL first.`);
      setProfile(profileRow);
      setLoading(false);
      return;
    }

    const safeChats = (chatRows || []) as AnyRow[];
    const chatIds = safeChats.map((chat) => chat.id);
    let messageRows: AnyRow[] = [];

    if (chatIds.length > 0) {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: true });

      messageRows = (data || []) as AnyRow[];
    }

    setProfile(profileRow);
    setChats(safeChats);
    setMessages(messageRows);
    setTickets((ticketRows || []) as AnyRow[]);
    setSelectedChatId((current) => safeChats.find((chat) => chat.id === current)?.id || safeChats[0]?.id || "");
    localStorage.setItem("sur_login_email", cleanEmail);
    localStorage.setItem("sur_profile_id", profileRow.id);
    setLoading(false);
  }

  async function ensureChat() {
    if (!profile) throw new Error("Login first to start chat.");
    const current = chats.find((chat) => chat.id === selectedChatId && !["CLOSED", "RESOLVED"].includes(normalize(chat.status)));
    if (current) return current;

    const { data, error } = await supabase
      .from("support_chats")
      .insert({
        profile_id: profile.id,
        subject: "Support chat",
        status: "AI_ASSISTING",
        channel: "INVESTOR",
      })
      .select("*")
      .single();

    if (error) throw error;
    setChats((rows) => [data, ...rows]);
    setSelectedChatId(data.id);
    return data;
  }

  async function sendMessage(text = draft) {
    const clean = text.trim();
    if (!clean) return;

    try {
      setNotice("");
      setDraft("");
      const chat = await ensureChat();

      const { data: userMessage, error: userError } = await supabase
        .from("support_messages")
        .insert({ chat_id: chat.id, profile_id: profile?.id, sender_role: "CUSTOMER", body: clean })
        .select("*")
        .single();

      if (userError) throw userError;
      setMessages((rows) => [...rows, userMessage]);

      const answer = getAiAnswer(clean);
      const { data: aiMessage } = await supabase
        .from("support_messages")
        .insert({ chat_id: chat.id, profile_id: profile?.id, sender_role: "AI", body: answer })
        .select("*")
        .single();

      if (aiMessage) setMessages((rows) => [...rows, aiMessage]);
      await supabase.from("support_chats").update({ status: "AI_ASSISTING", updated_at: new Date().toISOString() }).eq("id", chat.id);
      await loadSupport(profile?.email || email);
    } catch (err: any) {
      setNotice(err?.message || "Unable to send message.");
    }
  }

  async function escalateToAdmin() {
    try {
      const chat = await ensureChat();
      const { error } = await supabase
        .from("support_chats")
        .update({ status: "ADMIN_QUEUE", escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", chat.id);
      if (error) throw error;

      await supabase.from("support_messages").insert({
        chat_id: chat.id,
        profile_id: profile?.id,
        sender_role: "SYSTEM",
        body: "Admin live chat requested. Please wait for an admin reply.",
      });

      setNotice("Admin live chat requested.");
      await loadSupport(profile?.email || email);
    } catch (err: any) {
      setNotice(err?.message || "Unable to escalate chat.");
    }
  }

  async function convertToTicket() {
    if (!profile) {
      setNotice("Login first to create a ticket.");
      return;
    }

    try {
      const chat = await ensureChat();
      const chatMessages = messagesFor(chat.id);
      const subject = ticketSubject.trim() || chat.subject || "Support follow-up";
      const body = chatMessages.map((item) => `${item.sender_role}: ${item.body}`).join("\n\n") || "Support chat converted to ticket.";

      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          profile_id: profile.id,
          subject,
          message: body,
          status: "OPEN",
        })
        .select("*")
        .single();

      if (error) throw error;

      await supabase.from("support_chats").update({ status: "TICKET_OPEN", ticket_id: ticket.id, updated_at: new Date().toISOString() }).eq("id", chat.id);
      await supabase.from("support_messages").insert({
        chat_id: chat.id,
        profile_id: profile.id,
        sender_role: "SYSTEM",
        body: `Converted to official ticket: ${subject}`,
      });
      await supabase.from("notifications").insert({
        profile_id: profile.id,
        title: "Support ticket created",
        message: `Your chat was converted to ticket "${subject}".`,
        is_read: false,
      });

      setTicketSubject("");
      setTab("TICKETS");
      setNotice("Chat converted to official ticket.");
      await loadSupport(profile.email);
    } catch (err: any) {
      setNotice(err?.message || "Unable to convert chat to ticket.");
    }
  }

  function messagesFor(chatId: string) {
    return messages.filter((item) => item.chat_id === chatId);
  }

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) || null;
  const selectedMessages = selectedChat ? messagesFor(selectedChat.id) : [];
  const openTickets = tickets.filter((ticket) => normalize(ticket.status) === "OPEN").length;
  const activeChats = chats.filter((chat) => !["CLOSED", "RESOLVED"].includes(normalize(chat.status))).length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Support</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">Support Chat</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Ask simple questions first, escalate to admin live chat when needed, or convert the conversation to an official ticket.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadSupport()} disabled={loading} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90 disabled:opacity-60">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link href="/investor/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat label="Active Chats" value={String(activeChats)} />
            <HeroStat label="Open Tickets" value={String(openTickets)} />
            <HeroStat label="History" value={String(chats.length + tickets.length)} />
          </div>

          {notice && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{notice}</div>}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.34fr_1fr]">
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <h2 className="text-2xl font-black text-slate-950">Support</h2>
            <div className="mt-5 grid gap-2">
              {(["CHAT", "TICKETS", "HISTORY"] as TabMode[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-black ${tab === item ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"}`}
                >
                  {item === "CHAT" ? "Chat" : item === "TICKETS" ? "Tickets" : "History"}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Account</p>
              <p className="mt-2 text-sm font-black text-slate-950">{profile?.full_name || "Not loaded"}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{profile?.email || email || "-"}</p>
            </div>
          </aside>

          {tab === "CHAT" && (
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Chat First</h2>
                  <p className="mt-1 text-sm text-slate-600">AI handles common questions. Escalate only when the answer is not enough.</p>
                </div>
                <Badge value={selectedChat?.status || "READY"} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)} className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-900 hover:bg-emerald-100">
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="mt-5 h-[460px] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                {selectedMessages.length === 0 ? (
                  <Empty text="Start a conversation. Ask about wallet, trees, certificates, orders, account access, or admin help." />
                ) : (
                  <div className="space-y-3">
                    {selectedMessages.map((item) => (
                      <ChatBubble key={item.id} row={item} />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendMessage();
                  }}
                  placeholder="Type your question..."
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <button onClick={() => sendMessage()} className="rounded-2xl bg-emerald-600 px-8 py-4 text-sm font-black text-white hover:bg-emerald-700">
                  Send
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={ticketSubject}
                  onChange={(event) => setTicketSubject(event.target.value)}
                  placeholder="Ticket subject if official tracking is needed"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                />
                <button onClick={escalateToAdmin} className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-900 hover:bg-amber-100">
                  Admin Live Chat
                </button>
                <button onClick={convertToTicket} className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-sm font-black text-white hover:bg-slate-800">
                  Convert to Ticket
                </button>
              </div>
            </section>
          )}

          {tab === "TICKETS" && (
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">Tickets</h2>
              <div className="mt-5 grid gap-3">
                {tickets.length === 0 ? <Empty text="No official support tickets yet." /> : tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
              </div>
            </section>
          )}

          {tab === "HISTORY" && (
            <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
              <h2 className="text-2xl font-black text-slate-950">History</h2>
              <div className="mt-5 grid gap-3">
                {chats.length === 0 ? (
                  <Empty text="No chat history yet." />
                ) : (
                  chats.map((chat) => (
                    <button key={chat.id} onClick={() => { setSelectedChatId(chat.id); setTab("CHAT"); }} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{chat.subject || "Support chat"}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(chat.created_at)}</p>
                        </div>
                        <Badge value={chat.status || "OPEN"} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function getAiAnswer(input: string) {
  const text = input.toLowerCase();
  if (text.includes("cash") || text.includes("wallet") || text.includes("payment")) {
    return "For wallet and cash-in concerns, open Wallet to check your balance, cash-in requests, withdrawal requests, and official payment instructions. If a payment does not appear after admin review, escalate this chat.";
  }
  if (text.includes("tree") || text.includes("ag") || text.includes("denr")) {
    return "AG tree records appear in My AG Trees after admin approves a seedling purchase and generates tree registry records with AG code, DENR tag, status, GPS, and growth logs.";
  }
  if (text.includes("certificate") || text.includes("legal") || text.includes("paper")) {
    return "Certificates and legal papers are visible from Certificates and My AG Trees once admin uploads or links the official documents.";
  }
  if (text.includes("order") || text.includes("marketplace") || text.includes("seedling")) {
    return "Marketplace orders need payment proof or wallet payment, then admin approval. Approved orders generate AG tree records.";
  }
  if (text.includes("kyc") || text.includes("profile") || text.includes("account")) {
    return "For KYC, open Profile and upload clear ID/selfie documents. Admin verifies the uploaded files before approving account status.";
  }
  if (text.includes("admin") || text.includes("human") || text.includes("live")) {
    return "You can tap Admin Live Chat so the operations team can reply directly in this conversation.";
  }
  return "I can help with wallet, cash-in, AG trees, certificates, marketplace orders, KYC, and account access. If this does not solve your concern, tap Admin Live Chat or convert this chat to an official ticket.";
}

function normalize(value?: string | null) {
  return String(value || "").toUpperCase();
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/16 p-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-white/65">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(value)}`}>{value}</span>;
}

function ChatBubble({ row }: { row: AnyRow }) {
  const role = normalize(row.sender_role);
  const alignRight = role === "CUSTOMER";
  const label = role === "CUSTOMER" ? "You" : role === "ADMIN" ? "Admin" : role === "AI" ? "AI Assistant" : "System";
  return (
    <div className={`flex ${alignRight ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[760px] rounded-3xl border p-4 ${alignRight ? "border-emerald-100 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
        <p className={`text-xs font-black uppercase tracking-wide ${alignRight ? "text-white/70" : "text-slate-500"}`}>{label}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{row.body || "-"}</p>
        <p className={`mt-3 text-xs font-bold ${alignRight ? "text-white/60" : "text-slate-400"}`}>{formatDate(row.created_at)}</p>
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: AnyRow }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-slate-950">{ticket.subject || "Support ticket"}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{ticket.message || "-"}</p>
          <p className="mt-3 text-xs font-bold text-slate-400">{formatDate(ticket.created_at)}</p>
        </div>
        <Badge value={ticket.status || "OPEN"} />
      </div>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-5 text-sm font-bold text-slate-500">{text}</div>;
}
