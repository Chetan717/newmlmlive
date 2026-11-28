// Use the parent catalog tier for editor graphics; plain selected graphics
// carry the same tier after the editor strips the parent object.
export function isPremiumTemplate(template) {
  if (!template) return false;
  const access = template._template ? template._template.templateAccess : template.templateAccess;
  return access === "premium";
}
