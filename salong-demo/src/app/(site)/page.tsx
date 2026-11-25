import { salon } from "@config";
import { pageMetadata } from "@/lib/seo";
import { BookingCta } from "@/components/home/BookingCta";
import { GalleryStrip } from "@/components/home/GalleryStrip";
import { Hero } from "@/components/home/Hero";
import { Intro } from "@/components/home/Intro";
import { Popular } from "@/components/home/Popular";
import { TeamTeaser } from "@/components/home/TeamTeaser";
import { Testimonials } from "@/components/home/Testimonials";
import { Visit } from "@/components/home/Visit";

export const metadata = pageMetadata(salon, { description: salon.description, path: "/" });

export default function HomePage() {
  return (
    <>
      <Hero />
      <Intro />
      <Popular />
      <TeamTeaser />
      <GalleryStrip />
      <Testimonials />
      <Visit />
      <BookingCta />
    </>
  );
}
