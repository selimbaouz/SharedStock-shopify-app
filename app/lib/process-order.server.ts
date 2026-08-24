import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import {
  ensureComponentInventoryItemIds,
  findLinksForBundles,
} from "./bundle-links.server";
import { toShopifyGid } from "./shopify-ids";

type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphqlErrorBody = {
  errors?: Array<{ message?: string }>;
};

type AdjustQuantitiesResponse = {
  data?: {
    inventoryAdjustQuantities?: {
      userErrors?: Array<{ field?: string[] | null; message?: string }>;
    } | null;
  };
} & GraphqlErrorBody;

export type OrderLineItem = {
  variantId: string;
  quantity: number;
};

export type ComponentDeduction = {
  bundleVariantId: string;
  bundleQuantity: number;
  componentVariantId: string;
  componentInventoryItemId: string;
  quantityNeeded: number;
  delta: number;
};

export function parseOrderCreatePayload(payload: Record<string, unknown>): {
  orderId: string | null;
  locationId: string | null;
  lineItems: OrderLineItem[];
} {
  const orderId = payload.id == null ? null : String(payload.id).trim();
  const locationId =
    payload.location_id == null ? null : String(payload.location_id).trim();

  const rawItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  const lineItems: OrderLineItem[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.variant_id == null) continue;
    const quantity = Number(record.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    lineItems.push({
      variantId: String(record.variant_id).trim(),
      quantity: Math.floor(quantity),
    });
  }

  return {
    orderId: orderId || null,
    locationId: locationId || null,
    lineItems,
  };
}

export function planComponentDeductions(
  lineItems: OrderLineItem[],
  links: Array<{
    bundleVariantId: string;
    componentVariantId: string;
    componentInventoryItemId: string | null;
    quantityNeeded: number;
  }>,
): { deductions: ComponentDeduction[]; skipped: string[] } {
  const bundleQuantity = new Map<string, number>();
  for (const item of lineItems) {
    const bundleVariantId = toShopifyGid("ProductVariant", item.variantId);
    bundleQuantity.set(
      bundleVariantId,
      (bundleQuantity.get(bundleVariantId) ?? 0) + item.quantity,
    );
  }

  const skipped: string[] = [];
  const deductions: ComponentDeduction[] = [];

  for (const link of links) {
    const quantity = bundleQuantity.get(link.bundleVariantId) ?? 0;
    if (quantity <= 0) continue;
    if (!link.componentInventoryItemId) {
      skipped.push(link.componentVariantId);
      continue;
    }

    deductions.push({
      bundleVariantId: link.bundleVariantId,
      bundleQuantity: quantity,
      componentVariantId: link.componentVariantId,
      componentInventoryItemId: link.componentInventoryItemId,
      quantityNeeded: link.quantityNeeded,
      delta: -(quantity * link.quantityNeeded),
    });
  }

  return { deductions, skipped };
}

export function aggregateDeltasByInventoryItem(
  deductions: ComponentDeduction[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const deduction of deductions) {
    const inventoryItemGid = toShopifyGid(
      "InventoryItem",
      deduction.componentInventoryItemId,
    );
    deltas.set(
      inventoryItemGid,
      (deltas.get(inventoryItemGid) ?? 0) + deduction.delta,
    );
  }
  return deltas;
}

async function claimProcessedOrder(
  shop: string,
  orderId: string,
): Promise<boolean> {
  try {
    await prisma.processedOrder.create({
      data: { shop, orderId },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

async function releaseProcessedOrder(shop: string, orderId: string) {
  await prisma.processedOrder.deleteMany({
    where: { shop, orderId },
  });
}

async function resolveShopLocationId(
  admin: GraphqlClient,
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    query SharedStockPrimaryLocation {
      locations(first: 1) {
        nodes {
          id
        }
      }
    }`,
  );
  const json = (await response.json()) as {
    data?: { locations?: { nodes?: Array<{ id?: string } | null> } };
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }
  return json.data?.locations?.nodes?.[0]?.id ?? null;
}

async function adjustComponentQuantities(
  admin: GraphqlClient,
  locationGid: string,
  deltas: Map<string, number>,
  orderId: string,
): Promise<void> {
  const changes = [...deltas.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([inventoryItemId, delta]) => ({
      inventoryItemId,
      locationId: locationGid,
      delta,
    }));

  if (changes.length === 0) return;

  const response = await admin.graphql(
    `#graphql
    mutation SharedStockAdjustComponentQuantity($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          name: "available",
          reason: "correction",
          referenceDocumentUri: `gid://shopify/Order/${orderId}`,
          changes,
        },
      },
    },
  );
  const json = (await response.json()) as AdjustQuantitiesResponse;
  if (json.errors?.length) {
    throw new Error(
      json.errors
        .map((error) => error.message)
        .filter(Boolean)
        .join("; "),
    );
  }

  const userErrors =
    json.data?.inventoryAdjustQuantities?.userErrors?.filter(
      (entry) => entry.message,
    ) ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((entry) => entry.message).join("; "));
  }
}

export async function deductComponentsForOrder(options: {
  admin: GraphqlClient;
  shop: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { admin, shop, payload } = options;
  const parsed = parseOrderCreatePayload(payload);
  if (!parsed.orderId) {
    console.error(
      `[SharedStock] orders/create ignored for ${shop}: missing order id`,
    );
    return;
  }

  const bundleVariantIds = [
    ...new Set(
      parsed.lineItems.map((item) =>
        toShopifyGid("ProductVariant", item.variantId),
      ),
    ),
  ];
  const foundLinks = await findLinksForBundles(shop, bundleVariantIds);
  if (foundLinks.length === 0) {
    return;
  }

  const claimed = await claimProcessedOrder(shop, parsed.orderId);
  if (!claimed) {
    console.log(
      `[SharedStock] Order ${parsed.orderId} on ${shop} already processed; skipping`,
    );
    return;
  }

  try {
    const links = await ensureComponentInventoryItemIds(
      admin,
      shop,
      foundLinks,
    );
    const { deductions, skipped } = planComponentDeductions(
      parsed.lineItems,
      links,
    );
    for (const componentVariantId of skipped) {
      console.error(
        `[SharedStock] Skipping component ${componentVariantId} on order ${parsed.orderId}: missing inventory item id`,
      );
    }

    const deltas = aggregateDeltasByInventoryItem(deductions);
    if (deltas.size === 0) {
      console.error(
        `[SharedStock] Order ${parsed.orderId} on ${shop} contains bundles but no component could be deducted`,
      );
      await releaseProcessedOrder(shop, parsed.orderId);
      return;
    }

    const locationGid = parsed.locationId
      ? toShopifyGid("Location", parsed.locationId)
      : await resolveShopLocationId(admin);
    if (!locationGid) {
      throw new Error("no location available for inventory adjustment");
    }

    await adjustComponentQuantities(admin, locationGid, deltas, parsed.orderId);

    const soldBundles = [
      ...new Set(deductions.map((deduction) => deduction.bundleVariantId)),
    ];
    console.log(
      `[SharedStock] Order ${parsed.orderId} on ${shop}: sold bundle(s) ${soldBundles.join(", ")}`,
    );
    for (const deduction of deductions) {
      console.log(
        `[SharedStock] Deducted component ${deduction.componentVariantId} by ${-deduction.delta} (bundle qty ${deduction.bundleQuantity} × ${deduction.quantityNeeded})`,
      );
    }
  } catch (error) {
    await releaseProcessedOrder(shop, parsed.orderId);
    throw error;
  }
}
