import { redirect } from "next/navigation";

export const metadata = {
  title: "Kirish | TravelorAI",
  description: "TravelorAI foydalanuvchi hisobiga kirish yoki ro'yxatdan o'tish.",
};

export default function LoginPage() {
  redirect("/signin");
}
