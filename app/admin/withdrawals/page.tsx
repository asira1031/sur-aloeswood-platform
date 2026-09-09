import { redirect } from "next/navigation";

// Settlement must use the atomic, authenticated treasury RPCs.
export default function WithdrawalsPage() {
  redirect("/admin/treasury");
}
