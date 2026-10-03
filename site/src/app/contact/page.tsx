import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${SITE.name} team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="pt-1 pb-5">
        <span className="label">Contact</span>
        <h1 className="h-display mt-3 text-[1.9rem] sm:text-[2.5rem]">Contact</h1>
      </div>
      <p className="prose-body mt-3">
        Email us at{" "}
        <a className="link" href={`mailto:${SITE.contactEmail}`}>
          {SITE.contactEmail}
        </a>{" "}
        or use the form below. We reply within 2 business days.
      </p>
      <div className="panel mt-4 p-7">
        <ContactForm />
      </div>
    </div>
  );
}
