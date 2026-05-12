import { redirect } from "next/navigation";

export const metadata = {
  title: "Hero rasmlar | TravelorAI Admin",
};

export default function AdminHeroPage() {
  redirect("/admin/content");
}
