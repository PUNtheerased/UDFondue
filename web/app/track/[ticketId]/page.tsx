import { Suspense } from "react";
import { TrackClient } from "./TrackClient";

export default function TrackTicketPage({
  params
}: {
  params: { ticketId: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center text-gray-400">กำลังโหลด...</div>
      }
    >
      <TrackClient ticketId={params.ticketId} />
    </Suspense>
  );
}
