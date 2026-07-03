"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false },
);

export function AgentationProvider() {
  // Only render in development or when explicitly enabled
  if (process.env.NODE_ENV !== "development" && !process.env.NEXT_PUBLIC_AGENTATION_ENABLED) {
    return null;
  }

  return (
    <Agentation
      onAnnotationAdd={(annotation) => {
        console.log("[Agentation] Annotation added:", annotation);
      }}
      onCopy={(markdown) => {
        console.log("[Agentation] Copied to clipboard:", markdown);
      }}
    />
  );
}
