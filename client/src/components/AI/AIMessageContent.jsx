import React from "react";
import { cleanAIMessageText } from "../../services/aiAnalyticsService";

/**
 * Clean AI Message Formatter
 * Eliminates all markdown asterisks (*, **) and renders pleasant,
 * structured retail intelligence text with proper line spacing.
 */
export default function AIMessageContent({ text = "", isUser = false }) {
  if (!text) return null;

  if (isUser) {
    return <span>{text}</span>;
  }

  // First pass: strip all asterisk artifacts
  const sanitized = cleanAIMessageText(text);

  // Split into lines/paragraphs
  const lines = sanitized.split("\n");

  return (
    <div className="ai-message-content">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();

        // Empty line -> spacing
        if (!line) {
          return <div key={idx} style={{ height: 6 }} />;
        }

        // Bullet point line
        if (line.startsWith("•") || line.startsWith("-")) {
          const bulletText = line.replace(/^[•-]\s*/, "");
          const colonIdx = bulletText.indexOf(":");
          
          if (colonIdx > 0 && colonIdx < 35) {
            const label = bulletText.substring(0, colonIdx + 1);
            const val = bulletText.substring(colonIdx + 1);
            return (
              <div key={idx} style={{ display: "flex", gap: 6, margin: "2px 0", lineHeight: 1.45 }}>
                <span style={{ color: "var(--brand-primary, #f15a24)", fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>
                  <strong style={{ fontWeight: 600, color: "#1e293b" }}>{label}</strong>
                  <span style={{ color: "#334155" }}>{val}</span>
                </span>
              </div>
            );
          }

          return (
            <div key={idx} style={{ display: "flex", gap: 6, margin: "2px 0", lineHeight: 1.45 }}>
              <span style={{ color: "var(--brand-primary, #f15a24)", fontWeight: 700, flexShrink: 0 }}>•</span>
              <span style={{ color: "#334155" }}>{bulletText}</span>
            </div>
          );
        }

        // Numbered list item: 1. or 2.
        const numMatch = line.match(/^(\d+\.)\s*(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: "flex", gap: 6, margin: "3px 0", lineHeight: 1.45 }}>
              <span style={{ color: "var(--brand-primary, #f15a24)", fontWeight: 700, flexShrink: 0 }}>{numMatch[1]}</span>
              <span style={{ color: "#334155" }}>{numMatch[2]}</span>
            </div>
          );
        }

        // Section header ending with a colon or short uppercase line
        if ((line.endsWith(":") && line.length < 50) || line.startsWith("Store Revenue Summary") || line.startsWith("Top Highest Margin")) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: "#0f172a", marginTop: idx > 0 ? 6 : 0, marginBottom: 2 }}>
              {line}
            </div>
          );
        }

        // Standard narrative line
        return (
          <p key={idx} style={{ margin: "2px 0", lineHeight: 1.45, color: "#334155" }}>
            {line}
          </p>
        );
      })}
    </div>
  );
}
