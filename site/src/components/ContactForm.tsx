"use client";

import { useState } from "react";

export default function ContactForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="text-3xl">✓</span>
        <p className="font-semibold">Message received</p>
        <p className="text-sm text-t3">We&apos;ll reply within 2 business days.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (state === "sending") return;
        setErr(null);
        setState("sending");
        try {
          const res = await fetch("/api/contact", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, message }),
          });
          if (res.ok) {
            setState("sent");
            return;
          }
          const data = await res.json().catch(() => ({}));
          setErr(
            data.error === "rate_limited"
              ? "Too many messages — please try again in a minute."
              : "Could not send. Please email us directly."
          );
          setState("error");
        } catch {
          setErr("Network error. Please email us directly.");
          setState("error");
        }
      }}
    >
      <div>
        <label htmlFor="email" className="text-sm font-medium text-t2">
          Your email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-s2 px-4 py-2.5 text-sm outline-none focus:border-line-2 focus:ring-2 focus:ring-t4/30"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="message" className="text-sm font-medium text-t2">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-s2 px-4 py-2.5 text-sm outline-none focus:border-line-2 focus:ring-2 focus:ring-t4/30"
          placeholder="How can we help?"
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="btn btn-primary w-full disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
