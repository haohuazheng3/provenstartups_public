"use client";

import { useEffect } from "react";

/** Auth CTAs often sit deep in long project pages; always reveal the sign-in card. */
export default function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return null;
}
