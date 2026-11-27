import { Crown, Image, Clapperboard, Plus } from "lucide-react";

// Decorative artwork: no remote assets, no extra network requests.
export default function PlanArtwork({ kind = "combo", hero = false }) {
  return <span aria-hidden="true" className={`mlm-plan-art ${hero ? "mlm-plan-art-hero" : ""} mlm-art-${kind}`}>
    {hero && <Crown className="mlm-art-crown" strokeWidth={2.4} />}
    {kind !== "video" && <span className="mlm-art-tile mlm-art-poster"><Image strokeWidth={2.3}/></span>}
    {kind === "combo" && <span className="mlm-art-plus"><Plus size={14} strokeWidth={3}/></span>}
    {kind !== "poster" && <span className="mlm-art-tile mlm-art-video"><Clapperboard strokeWidth={2.3}/></span>}
  </span>;
}
