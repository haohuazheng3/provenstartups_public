import type { Metadata } from "next";
import Link from "@/components/HoverLink";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How we turn founder interviews into actionable startup breakdowns: sourcing, transcription, evidence grading, and build prompts.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  {
    n: "01",
    title: "Source",
    body: "We continuously scan founder interviews, indie-hacker breakdowns, and case-study videos across YouTube and other platforms — the places where people actually say their numbers out loud.",
  },
  {
    n: "02",
    title: "Transcribe & dissect",
    body: "Every video is transcribed and taken apart line by line: revenue claims, team size, tech stack, costs, acquisition channels, timelines, failures. No paraphrasing from memory — the transcript is the source of truth.",
  },
  {
    n: "03",
    title: "Grade the evidence",
    body: "Each idea gets an evidence label: ✅ verified with third-party data, 🗣 founder-reported, 📎 creator-reported, or 🔮 unverified potential. Revenue numbers are never presented as audited when they aren't.",
  },
  {
    n: "04",
    title: "Score & rank",
    body: "Five difficulty dimensions — build, acquisition, capital, competition, validation speed — plus an upside score. Ranked by what a solo, AI-assisted builder can realistically copy now, not by fame.",
  },
  {
    n: "05",
    title: "Package the playbook",
    body: "Every breakdown carries four fixed founder playbooks — first customers, first dollar, the flywheel, the no-feedback stretch — plus a replication card and, for members, tailored build specs you paste straight into Claude Code or Codex.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">How it works</span>
        <h1 className="h-display mt-3 text-[1.9rem] sm:text-[2.5rem]">How it works</h1>
      </div>
      <div className="mt-6 space-y-4">
        {steps.map((s) => (
          <div key={s.n} className="panel p-6 sm:p-7">
            <h2 className="flex items-baseline gap-3">
              <span className="serif text-[1.7rem] leading-none text-brand/30">{s.n}</span>
              <span className="h-sec text-[1.35rem]">{s.title}</span>
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-t2">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/projects" className="btn btn-primary btn-lg">
          Browse the ideas
        </Link>
      </div>
    </div>
  );
}
