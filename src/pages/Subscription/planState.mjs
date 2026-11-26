export function grantAvailable(g, now = Date.now()) {
  if (g.revoked || !(g.expiresAtMs > now)) return false;
  return (g.serviceType || "poster") === "poster"
    ? g.unlimitedDownloads === true || Number(g.remainingDownloads) > 0
    : g.remainingCredits == null || Number(g.remainingCredits) > 0;
}
// Free designs use the tier carried by the catalog. Only a premium export asks
// the existing authenticated payment service for the current account's grants.
export async function canExportPoster(access, launched, readEntitlement) {
  if (!launched || access !== "premium") return true;
  const entitlement = await readEntitlement();
  if (!Array.isArray(entitlement?.grants) || !entitlement.services?.poster) {
    throw new Error("Poster plan could not be verified.");
  }
  const poster = entitlement.services.poster;
  return poster.status === "active" && entitlement.grants.some(grant =>
    grant.purchaseId === poster.currentPurchaseId &&
    (grant.serviceType || "poster") === "poster" &&
    grant.startsAtMs <= Date.now() && grantAvailable(grant)
  );
}

export function eligiblePlans(plans, entitlement, now = Date.now()) {
  const held = new Set(
    (entitlement?.grants || [])
      .filter((g) => grantAvailable(g, now))
      .map((g) => g.serviceType || "poster"),
  );
  return plans.filter(
    (p) =>
      p.Launch !== false &&
      (p.serviceType === "combo"
        ? !held.has("poster") && !held.has("video")
        : !held.has(p.serviceType || "poster")),
  );
}
export const money = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number(paise) % 100 ? 2 : 0,
  }).format(Number(paise || 0) / 100);
export const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
export function planBenefits(p) {
  const benefits = [
    p.serviceType === "video"
      ? "Video Editing Service"
      : p.serviceType === "combo"
        ? "Poster Design + Video Editing Service"
        : "Poster Design Service",
    `${p.Day_value} days validity`,
  ];
  if (p.serviceType !== "video")
    benefits.push(
      p.unlimitedDownloads
        ? "Unlimited poster downloads"
        : `${p.downloads || 0} poster download credits`,
    );
  if (p.serviceType !== "poster" && p.serviceType)
    benefits.push(
      p.videoCredits == null
        ? "Video service for the plan validity"
        : `${p.videoCredits} video editing credits`,
    );
  if (p.Description) benefits.push(p.Description);
  return benefits;
}
