/**
 * Entry for the hosted preview: the same pages and components as the Next.js
 * app, rendered client-side behind a hash router. Build with `npm run preview:build`.
 */
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import HomePage from "@/app/(site)/page";
import ServicesPage from "@/app/(site)/tjenester/page";
import TeamPage from "@/app/(site)/team/page";
import GalleryPage from "@/app/(site)/galleri/page";
import AboutPage from "@/app/(site)/om-oss/page";
import NotFound from "@/app/not-found";
import SiteLayout from "@/app/(site)/layout";
import BookingLayout from "@/app/(booking)/layout";
import Template from "@/app/(site)/template";
import { AdminApp } from "@/components/admin/AdminApp";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { Confirmation } from "@/components/booking/Confirmation";
import { useRoute } from "./router";

const sitePages: Record<string, () => React.ReactNode> = {
  "/": HomePage,
  "/tjenester": ServicesPage,
  "/team": TeamPage,
  "/galleri": GalleryPage,
  "/om-oss": AboutPage,
};

function App() {
  const route = useRoute();

  useEffect(() => {
    const target = route.anchor ? document.getElementById(route.anchor) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [route]);

  const key = `${route.path}?${route.query.toString()}`;

  if (route.path === "/admin") {
    return (
      <div className="min-h-dvh bg-paper">
        <AdminApp />
      </div>
    );
  }
  if (route.path === "/bestill") {
    const serviceIds = (route.query.get("tjeneste") ?? "").split(",").filter(Boolean);
    return (
      <BookingLayout>
        <BookingFlow key={key} initialServiceIds={serviceIds} initialStaffId={route.query.get("frisor")} />
      </BookingLayout>
    );
  }
  if (route.path.startsWith("/bestilling/")) {
    return (
      <BookingLayout>
        <Confirmation key={key} reference={route.path.slice("/bestilling/".length)} />
      </BookingLayout>
    );
  }
  const Page = sitePages[route.path];
  if (!Page) return <NotFound />;
  return (
    <SiteLayout>
      <Template key={key}>
        <Page />
      </Template>
    </SiteLayout>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
