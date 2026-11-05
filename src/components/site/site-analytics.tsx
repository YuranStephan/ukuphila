"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { isPublicAnalyticsPath, publicPageView } from "@/lib/analytics";

export function SiteAnalytics() {
  const pathname = usePathname();
  if (process.env.NODE_ENV !== "production" || !isPublicAnalyticsPath(pathname)) return null;
  return <Analytics beforeSend={publicPageView} />;
}
