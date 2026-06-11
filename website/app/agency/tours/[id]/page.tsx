import TourEditor from "@/components/agency/TourEditor";

export const metadata = {
  title: "Tourni tahrirlash | TravelorAI Agency",
};

export default async function AgencyEditTourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TourEditor tourId={id} />;
}
