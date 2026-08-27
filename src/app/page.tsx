"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Property = {
  id: number;
  name: string;
  address: string;
  wifi_name: string;
  wifi_password: string;
  check_in: string;
  check_out: string;
  house_rules: string;
  emergency_contact: string;
  vector_store_id?: string;
};

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What is the Wi-Fi password?",
  "When is check-out?",
  "What are the house rules?",
  "Who do I contact in an emergency?",
];

export default function Home() {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Welcome! I’m your digital house guide. Ask me anything about the home or your stay." },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProperty() {
      const { data, error } = await supabase.from("properties").select("*").limit(1).single();
      if (!error) setProperty(data);
      setLoading(false);
    }
    loadProperty();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isSending, messages]);

  async function askAI(question = message) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !property || isSending) return;

    const userMessage: Message = { role: "user", content: trimmedQuestion };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setMessage("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, property }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to get a response.");
      setMessages((current) => [...current, {
        role: "assistant",
        content: data.reply || "I’m sorry, I couldn’t find an answer to that. Please contact your host.",
      }]);
    } catch {
      setMessages((current) => [...current, {
        role: "assistant",
        content: "I’m having trouble connecting right now. Please try again in a moment.",
      }]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAI();
  }

  if (loading) {
    return <main className="guest-guide guest-guide--loading" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /></div><p>Opening your house guide</p></main>;
  }

  return (
    <main className="guest-guide">
      <div className="guest-guide__shell">
        <header className="guide-header">
          <div className="guide-header__brand"><span className="brand-mark" aria-hidden="true">G</span><span>GuestFlow</span></div>
          <div className="guide-header__status"><span aria-hidden="true" /> Available 24/7</div>
          <p className="guide-header__eyebrow">Your stay at</p>
          <h1>{property?.name || "Your home away from home"}</h1>
          {property?.address && <p className="guide-header__address">{property.address}</p>}
        </header>

        <section className="conversation" aria-label="Conversation with house guide">
          <div className="welcome-note"><span className="welcome-note__icon" aria-hidden="true">✦</span><p>Everything you need for a smooth stay, right here.</p></div>
          <div className="message-list">
            {messages.map((item, index) => (
              <article className={`message message--${item.role}`} key={`${item.role}-${index}`}>
                {item.role === "assistant" && <span className="message__avatar" aria-hidden="true">G</span>}
                <p>{item.content}</p>
              </article>
            ))}
            {isSending && <div className="message message--assistant" aria-label="House guide is typing"><span className="message__avatar" aria-hidden="true">G</span><div className="typing-dots"><span /><span /><span /></div></div>}
            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="guide-composer">
          <div className="suggestions" aria-label="Suggested questions">
            {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" disabled={isSending} onClick={() => void askAI(suggestion)}>{suggestion}</button>)}
          </div>
          <form className="composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="guest-question">Ask a question</label>
            <input id="guest-question" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask a question about the home" disabled={isSending || !property} autoComplete="off" />
            <button type="submit" disabled={!message.trim() || isSending || !property} aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-8.5 18-2.4-7.1L3 11.5 21 3Z" /><path d="m10.1 13.9 3.4-3.4" /></svg></button>
          </form>
          <p className="guide-composer__note">Powered by GuestFlow · Your digital house guide</p>
        </footer>
      </div>
    </main>
  );
}
