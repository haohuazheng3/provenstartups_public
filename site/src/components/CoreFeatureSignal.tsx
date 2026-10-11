"use client";

import { useEffect } from "react";

type CoreFeature = "deep_dive" | "pro_only_project";

/**
 * A successful render of protected project content is the product activation.
 * Keep the first signal per project/feature in each browser session so reloads
 * and client navigations cannot inflate the funnel.
 */
export default function CoreFeatureSignal({
  feature,
  projectSlug,
}: {
  feature: CoreFeature;
  projectSlug: string;
}) {
  useEffect(() => {
    const key = `ps_core_feature:${projectSlug}:${feature}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // A blocked sessionStorage must not prevent the event itself.
    }

    const params = new URLSearchParams(location.search);
    const testRun = params.get("test_run") === "true";
    const props = {
      feature,
      project_slug: projectSlug,
      ...(testRun ? { test_run: true, exclude_from_conversion: true } : {}),
    };

    // Analytics mounts after the page subtree, so defer until its effect has
    // installed psTrack. FlowGlance accepts queued public-API calls.
    const timer = window.setTimeout(() => {
      window.psTrack?.("core_feature_used", props);
      // FlowGlance does not interpret exclude_from_conversion as an exclusion
      // instruction. The beforeInteractive guard also sets fw_exclude, and this
      // branch is a second line of defence if that third-party cookie contract
      // changes or the script was already queued.
      if (!testRun) window.fw?.("event", "core_feature_used", props);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [feature, projectSlug]);

  return null;
}
