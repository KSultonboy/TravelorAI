"use client";

import { useEffect } from "react";
import { trackPublicEventOnce, type PublicProductEvent } from "@/lib/productEvents";

/** Sahifa ochilganda voronka hodisasini (sessiyada bir marta) yuboradi. Hech narsa chizmaydi. */
export default function ProductEventPing({ name }: { name: PublicProductEvent }) {
  useEffect(() => {
    trackPublicEventOnce(name);
  }, [name]);
  return null;
}
