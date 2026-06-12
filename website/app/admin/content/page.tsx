import { redirect } from "next/navigation";

// Eski monolit "Platform overview" sahifasi bo'laklarga ajratildi:
// /admin (boshqaruv), /admin/moderation, /admin/leads, /admin/agencies,
// /admin/places, /admin/stories, /admin/hero, /admin/reports
export default function AdminContentPage() {
  redirect("/admin");
}
