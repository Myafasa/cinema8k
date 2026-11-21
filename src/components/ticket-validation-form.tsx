"use client";

import { useActionState } from "react";
import { validateTicketAction } from "@/app/actions/cashier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TicketValidationForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(validateTicketAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <label className="block space-y-2 text-sm font-medium">
        Kode tiket atau QR
        <Input name="payload" autoComplete="off" autoFocus placeholder="Scan QR atau masukkan T-…" required maxLength={256} />
      </label>
      {state.success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Memeriksa…" : "Validasi tiket"}</Button>
    </form>
  );
}
