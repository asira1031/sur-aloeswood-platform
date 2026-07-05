"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase/client";
import { formatDate, getProfile, statusClass, type AnyRow } from "@/app/lib/support/utils";

type QueueMode = "CHATS" | "TICKETS";

export default function AdminSupportPage() {
  const [mode, setMode] = useState<QueueMode>("CHATS");
  const [chats, setChats] = useState<AnyRow[]>([]);
  const [messages, setMessages] = useState<AnyRow[]>([]);
  const [tickets, setTickets] = useState<AnyRow[]>([]);
  const [profiles, setProfiles] = useState<AnyRow[]>([]);
  const [selectedChat, setSelectedChat] = useState<AnyRow | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<AnyRow | null>(null);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadSupport();
  }, []);

  async function loadSupport() {
    setNotice("");

    const [{ data: chatRows, error: chatError }, { data: ticketRows, error: ticketError }, { data: profileRows }] = await Promise.all([
      supabase.from("support_chats").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id, full_name, email, mobile, mobile_number, role, account_status, kyc_status").limit(1000),
    ]);

    if (chatError) {
      setNotice(`${chatError.message}. Run the support chat SQL first.`);
      return;
    }

    if (ticketError) {
      setNotice(ticketError.message);
      return;
    }

    const safeChats = (chatRows || []) as AnyRow[];
    const safeTickets = (ticketRows || []) as AnyRow[];
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

    setChats(safeChats);
    setTickets(safeTickets);
    setMessages(messageRows);
    setProfiles((profileRows || []) as AnyRow[]);
    setSelectedChat((current) => safeChats.find((chat) => chat.id === current?.id) || safeChats[0] || null);
    setSelectedTicket((current) => safeTickets.find((ticket) => ticket.id === current?.id) || safeTickets[0] || null);
  }

  async function sendChatReply() {
    if (!selectedChat || !reply.trim()) {
      setNotice("Select a chat and write a reply.");
      return;
    }

    setBusyId(selectedChat.id);
    setNotice("");

    const cleanReply = reply.trim();
    const { error } = await supabase.from("support_messages").insert({
      chat_id: selectedChat.id,
      profile_id: selectedChat.profile_id,
      sender_role: "ADMIN",
      body: cleanReply,
    });

    if (error) {
      setNotice(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("support_chats").update({ status: "ACTIVE", updated_at: new Date().toISOString() }).eq("id", selectedChat.id);
    await supabase.from("notifications").insert({
      profile_id: selectedChat.profile_id,
      title: "Support reply",
      message: cleanReply,
      is_read: false,
    });

    setReply("");
    setNotice("Reply sent and investor notification created.");
    await loadSupport();
    setBusyId("");
  }

  async function updateChatStatus(status: string) {
    if (!selectedChat) return;
    setBusyId(selectedChat.id);
    const { error } = await supabase.from("support_chats").update({ status, updated_at: new Date().toISOString() }).eq("id", selectedChat.id);
    if (error) setNotice(error.message);
    await loadSupport();
    setBusyId("");
  }

  async function updateTicketStatus(ticket: AnyRow, status: string) {
    setBusyId(ticket.id);
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticket.id);
    if (error) {
      setNotice(error.message);
      setBusyId("");
      return;
    }

    await supabase.from("notifications").insert({
      profile_id: ticket.profile_id,
      title: `Support ticket ${status.toLowerCase()}`,
      message: `Your ticket "${ticket.subject}" is now ${status}.`,
      is_read: false,
    });
    setNotice(`Ticket updated to ${status}.`);
    await loadSupport();
    setBusyId("");
  }

  async function sendTicketReply() {
    if (!selectedTicket || !reply.trim()) {
      setNotice("Select a ticket and write a reply.");
      return;
    }

    setBusyId(selectedTicket.id);
    const cleanReply = reply.trim();
    const { error } = await supabase.from("notifications").insert({
      profile_id: selectedTicket.profile_id,
      title: `Support reply: ${selectedTicket.subject}`,
      message: cleanReply,
      is_read: false,
    });

    if (error) {
      setNotice(error.message);
      setBusyId("");
      return;
    }

    setReply("");
    setNotice("Ticket reply sent to investor notifications.");
    await loadSupport();
    setBusyId("");
  }

  const filteredChats = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return chats.filter((chat) => {
      const profile = getProfile(chat, profiles);
      const statusOk = filter === "ALL" || normalize(chat.status) === filter;
      const text = `${JSON.stringify(chat)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [chats, filter, profiles, search]);

  const filteredTickets = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return tickets.filter((ticket) => {
      const profile = getProfile(ticket, profiles);
      const statusOk = filter === "ALL" || normalize(ticket.status) === filter;
      const text = `${JSON.stringify(ticket)} ${profile?.full_name || ""} ${profile?.email || ""}`.toLowerCase();
      return statusOk && (!keyword || text.includes(keyword));
    });
  }, [tickets, filter, profiles, search]);

  const selectedChatProfile = selectedChat ? getProfile(selectedChat, profiles) : null;
  const selectedTicketProfile = selectedTicket ? getProfile(selectedTicket, profiles) : null;
  const selectedChatMessages = selectedChat ? messages.filter((message) => message.chat_id === selectedChat.id) : [];
  const liveQueue = chats.filter((chat) => ["ADMIN_QUEUE", "ACTIVE"].includes(normalize(chat.status))).length;
  const openTickets = tickets.filter((ticket) => normalize(ticket.status) === "OPEN").length;

  return (
    <main className="min-h-screen bg-[#f3f7f1] text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/20 p-6 shadow-sm lg:p-8">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/forest-bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/66 to-green-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-white/75">SUR Aloeswood Admin</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white lg:text-6xl">Support Command</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
                Manage live chat escalation, official tickets, investor notifications, and support history from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadSupport} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-white/90">Refresh</button>
              <Link href="/admin/dashboard" className="rounded-2xl border border-white/25 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20">Dashboard</Link>
            </div>
          </div>

          <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
            <HeroStat label="Live Queue" value={String(liveQueue)} />
            <HeroStat label="All Chats" value={String(chats.length)} />
            <HeroStat label="Open Tickets" value={String(openTickets)} />
            <HeroStat label="All Tickets" value={String(tickets.length)} />
          </div>

          {notice && <div className="relative z-10 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{notice}</div>}
        </section>

        <section className="grid gap-5 py-5 lg:grid-cols-[0.38fr_1fr]">
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            <div className="grid gap-2">
              <button onClick={() => setMode("CHATS")} className={`rounded-2xl px-4 py-3 text-left text-sm font-black ${mode === "CHATS" ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"}`}>Live Chat Queue</button>
              <button onClick={() => setMode("TICKETS")} className={`rounded-2xl px-4 py-3 text-left text-sm font-black ${mode === "TICKETS" ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"}`}>Ticket Queue</button>
            </div>

            <div className="mt-5 grid gap-3">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search support" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                <option value="ALL">All statuses</option>
                <option value="AI_ASSISTING">AI assisting</option>
                <option value="ADMIN_QUEUE">Admin queue</option>
                <option value="ACTIVE">Active</option>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {mode === "CHATS" && (filteredChats.length === 0 ? <Empty text="No live chats found." /> : filteredChats.map((chat) => {
                const profile = getProfile(chat, profiles);
                return (
                  <button key={chat.id} onClick={() => setSelectedChat(chat)} className={`w-full rounded-2xl border p-4 text-left ${selectedChat?.id === chat.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-emerald-50/60"}`}>
                    <p className="font-black text-slate-950">{profile?.full_name || "Unknown"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{profile?.email || "-"}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Badge value={chat.status || "OPEN"} />
                      <span className="text-xs font-bold text-slate-400">{formatDate(chat.updated_at || chat.created_at)}</span>
                    </div>
                  </button>
                );
              }))}

              {mode === "TICKETS" && (filteredTickets.length === 0 ? <Empty text="No tickets found." /> : filteredTickets.map((ticket) => {
                const profile = getProfile(ticket, profiles);
                return (
                  <button key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`w-full rounded-2xl border p-4 text-left ${selectedTicket?.id === ticket.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:bg-emerald-50/60"}`}>
                    <p className="font-black text-slate-950">{ticket.subject || "Support ticket"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{profile?.email || "-"}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Badge value={ticket.status || "OPEN"} />
                      <span className="text-xs font-bold text-slate-400">{formatDate(ticket.created_at)}</span>
                    </div>
                  </button>
                );
              }))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm lg:p-6">
            {mode === "CHATS" ? (
              !selectedChat ? <Empty text="Select a live chat." /> : (
                <>
                  <Header title={selectedChatProfile?.full_name || "Live chat"} subtitle={selectedChatProfile?.email || "-"} status={selectedChat.status || "OPEN"} />
                  <div className="mt-5 h-[500px] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    {selectedChatMessages.length === 0 ? <Empty text="No messages yet." /> : <div className="space-y-3">{selectedChatMessages.map((item) => <ChatBubble key={item.id} row={item} />)}</div>}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {["ACTIVE", "RESOLVED", "CLOSED"].map((status) => (
                      <button key={status} disabled={busyId === selectedChat.id} onClick={() => updateChatStatus(status)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">{status}</button>
                    ))}
                  </div>
                  <ReplyBox reply={reply} setReply={setReply} busy={busyId === selectedChat.id} onSend={sendChatReply} />
                </>
              )
            ) : (
              !selectedTicket ? <Empty text="Select a ticket." /> : (
                <>
                  <Header title={selectedTicket.subject || "Support ticket"} subtitle={selectedTicketProfile?.email || "-"} status={selectedTicket.status || "OPEN"} />
                  <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedTicket.message || "-"}</p>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((status) => (
                      <button key={status} disabled={busyId === selectedTicket.id} onClick={() => updateTicketStatus(selectedTicket, status)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">{status}</button>
                    ))}
                  </div>
                  <ReplyBox reply={reply} setReply={setReply} busy={busyId === selectedTicket.id} onSend={sendTicketReply} />
                </>
              )
            )}
          </section>
        </section>
      </div>
    </main>
  );
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

function Header({ title, subtitle, status }: { title: string; subtitle: string; status: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Support Thread</p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-bold text-slate-600">{subtitle}</p>
      </div>
      <Badge value={status} />
    </div>
  );
}

function ChatBubble({ row }: { row: AnyRow }) {
  const role = normalize(row.sender_role);
  const alignRight = role === "ADMIN";
  const label = role === "CUSTOMER" ? "Customer" : role === "ADMIN" ? "Admin" : role === "AI" ? "AI Assistant" : "System";
  return (
    <div className={`flex ${alignRight ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[780px] rounded-3xl border p-4 ${alignRight ? "border-emerald-100 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
        <p className={`text-xs font-black uppercase tracking-wide ${alignRight ? "text-white/70" : "text-slate-500"}`}>{label}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{row.body || "-"}</p>
        <p className={`mt-3 text-xs font-bold ${alignRight ? "text-white/60" : "text-slate-400"}`}>{formatDate(row.created_at)}</p>
      </div>
    </div>
  );
}

function ReplyBox({ reply, setReply, busy, onSend }: { reply: string; setReply: (value: string) => void; busy: boolean; onSend: () => void }) {
  return (
    <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
      <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={5} placeholder="Type admin reply..." className="w-full resize-none rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
      <button disabled={busy} onClick={onSend} className="mt-3 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">Send Reply</button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">{text}</div>;
}
