"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapPin, Send } from "lucide-react";
import { ChatMessage } from "@/components/chat-message";
import { TypingIndicator } from "@/components/typing-indicator";

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
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What's the Wi-Fi password?",
  "When is check-out?",
  "What are the house rules?",
  "Emergency contact?",
];

export default function Home() {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm GuestFlow AI. Ask me anything about your stay.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProperty() {
      const { data } = await supabase
        .from("properties")
        .select("*")
        .limit(1)
        .single();

      setProperty(data);
      setLoading(false);
    }

    loadProperty();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function askAI() {
  if (!message.trim() || !property) return;

  const 