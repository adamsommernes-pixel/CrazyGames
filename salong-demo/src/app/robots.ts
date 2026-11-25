import type { MetadataRoute } from "next";
import { salon } from "@config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/ansatte", "/bestilling/"] },
    sitemap: `${salon.siteUrl}/sitemap.xml`,
    host: salon.siteUrl,
  };
}
