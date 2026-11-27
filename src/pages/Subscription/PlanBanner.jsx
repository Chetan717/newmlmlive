import { useState } from "react";
import PlanArtwork from "./PlanArtwork";

export default function PlanBanner({ plan, kind = plan?.serviceType || "poster", priority = false }) {
  const url = typeof plan?.image_url === "string" && /^https:\/\//i.test(plan.image_url) ? plan.image_url : "";
  const [failed, setFailed] = useState("");
  const name = plan?.PlanName || (kind === "combo" ? "Combo Plan" : kind === "video" ? "Video Editing Plan" : "Poster Design Plan");
  return <div className={`mlm-plan-banner mlm-banner-${kind}`}>
    {url && failed !== url ? <img key={url} src={url} alt={`${name} banner`} loading={priority ? "eager" : "lazy"} decoding="async" onError={() => setFailed(url)} /> :
      <div className="mlm-banner-fallback" aria-hidden="true"><span>{name}</span><PlanArtwork kind={kind}/></div>}
  </div>;
}
