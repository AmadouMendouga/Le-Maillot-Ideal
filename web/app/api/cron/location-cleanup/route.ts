import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

async function deleteCollection(path: string): Promise<void> {
  while (true) {
    const snap = await adminDb.collection(path).limit(400).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET absent." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const due = await adminDb
    .collection("orders")
    .where("locationHistoryPurgeDueAt", "<=", new Date().toISOString())
    .limit(25)
    .get();

  for (const order of due.docs) {
    await Promise.all([
      deleteCollection(`orders/${order.id}/locationPoints`),
      deleteCollection(`orders/${order.id}/courierLocationPoints`),
    ]);
    await order.ref.update({
      locationHistoryPurgeDueAt: null,
      locationHistoryPurgedAt: new Date().toISOString(),
      liveLocation: null,
      courierLiveLocation: null,
    });
  }

  return Response.json({ ok: true, cleanedOrders: due.size });
}
