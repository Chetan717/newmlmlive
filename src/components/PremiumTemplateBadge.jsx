import React from "react";
import { isPremiumTemplate } from "../utils/templatePremium.js";
import "./PremiumTemplateBadge.css";

export default function PremiumTemplateBadge({ template, variant = "overlay" }) {
  if (!isPremiumTemplate(template)) return null;
  return (
    <span className={`premium-template-badge premium-template-badge--${variant}`}>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M2 4.5 5.5 7 8 2.5 10.5 7 14 4.5 12.7 12H3.3L2 4.5ZM3.5 13h9v1h-9z" />
      </svg>
      <span>Premium</span>
    </span>
  );
}
