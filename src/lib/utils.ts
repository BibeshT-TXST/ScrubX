import { createCn } from "cn/config";

// The clinical type scale (globals.css) adds text-meta … text-hero. Unregistered, the
// merger reads them as text colors, so `text-body` silently dropped `text-primary-foreground`
// (unreadable buttons) and `text-allow` dropped `text-meta` (oversized badges).
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["meta", "data", "body", "section", "title", "hero"] }] } },
});
