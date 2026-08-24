import prisma from "../db.server";
import { orderIdLookupValues } from "./compliance";

export async function redactShopData(shop: string) {
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop } }),
    prisma.bundleLink.deleteMany({ where: { shop } }),
    prisma.processedOrder.deleteMany({ where: { shop } }),
  ]);
}

export async function redactCustomerOrderData(
  shop: string,
  orderIds: string[],
): Promise<number> {
  const lookupIds = [
    ...new Set(orderIds.flatMap((id) => orderIdLookupValues(id))),
  ];
  if (lookupIds.length === 0) return 0;

  const result = await prisma.processedOrder.deleteMany({
    where: { shop, orderId: { in: lookupIds } },
  });
  return result.count;
}

export async function findStoredOrderIds(
  shop: string,
  orderIds: string[],
): Promise<string[]> {
  const lookupIds = [
    ...new Set(orderIds.flatMap((id) => orderIdLookupValues(id))),
  ];
  if (lookupIds.length === 0) return [];

  const rows = await prisma.processedOrder.findMany({
    where: { shop, orderId: { in: lookupIds } },
    select: { orderId: true },
  });
  return rows.map((row) => row.orderId);
}
