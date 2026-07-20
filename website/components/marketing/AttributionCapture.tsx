"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

// Har sahifa yuklanganda manbani tekshiradi. Hech narsa render qilmaydi.
export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
