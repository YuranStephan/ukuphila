import type { Metadata } from "next";
import { SignedOut } from "@/components/merchant/signed-out";

export const metadata: Metadata = { title: "Sessão terminada" };

export default function SignedOutPage() {
  return <SignedOut />;
}
