import type { MetadataRoute } from "next";
import { salon } from "@config";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1 },
    { path: "/tjenester", priority: 0.9 },
    { path: "/bestill", priority: 0.9 },
    { path: "/team", priority: 0.7 },
    { path: "/om-oss", priority: 0.7 },
    { path: "/galleri", priority: 0.5 },
  ];
  return pages.map((p) => ({
    url: `${salon.siteUrl}${p.path}`,
    changeFrequency: "monthly",
    priority: p.priority,
  }));
}
