import prisma from "../db.server";
import { formatVariantLabel } from "./bundle-form";
import { toInventoryItemLookupId } from "./shopify-ids";

type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type VariantNode = {
  id?: string;
  title?: string;
  inventoryQuantity?: number | null;
  inventoryItem?: {
    id?: string;
    legacyResourceId?: string | number | null;
  } | null;
  product?: { id?: string; title?: string } | null;
};

type NodesResponse = {
  data?: {
    nodes?: Array<VariantNode | null>;
  };
};

export type VariantDetails = {
  variantId: string;
  productId: string;
  title: string;
  variantTitle?: string;
  label: string;
};

export type BundleComponentInput = {
  componentVariantId: string;
  quantityNeeded: number;
  componentInventoryItemId?: string | null;
};

export async function fetchVariantDetails(
  admin: GraphqlClient,
  ids: string[],
): Promise<Map<string, VariantDetails>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const details = new Map<string, VariantDetails>();
  if (uniqueIds.length === 0) return details;

  try {
    const response = await admin.graphql(
      `#graphql
      query SharedStockVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            product {
              id
              title
            }
          }
        }
      }`,
      { variables: { ids: uniqueIds } },
    );
    const json = (await response.json()) as NodesResponse & {
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length) {
      console.error(
        `[SharedStock] Failed to fetch variant details: ${json.errors
          .map((error) => error.message)
          .filter(Boolean)
          .join("; ")}`,
      );
    }

    for (const node of json.data?.nodes ?? []) {
      if (!node?.id || !node.product?.id || !node.product.title) continue;
      details.set(node.id, {
        variantId: node.id,
        productId: node.product.id,
        title: node.product.title,
        variantTitle: node.title,
        label: formatVariantLabel(node.product.title, node.title),
      });
    }
  } catch {
    // List/edit screens fall back to the raw variant GID.
  }

  return details;
}

export async function fetchVariantInventory(
  admin: GraphqlClient,
  ids: string[],
): Promise<{ quantities: Map<string, number>; queryFailed: boolean }> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const quantities = new Map<string, number>();
  if (uniqueIds.length === 0) {
    return { quantities, queryFailed: false };
  }

  try {
    const response = await admin.graphql(
      `#graphql
      query SharedStockVariantInventory($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            inventoryQuantity
          }
        }
      }`,
      { variables: { ids: uniqueIds } },
    );
    const json = (await response.json()) as NodesResponse & {
      errors?: unknown[];
    };

    if (json.errors?.length) {
      console.error(
        `[SharedStock] Failed to fetch variant inventory: ${json.errors
          .map((error) => error.message)
          .filter(Boolean)
          .join("; ")}`,
      );
      return { quantities, queryFailed: true };
    }

    for (const node of json.data?.nodes ?? []) {
      if (!node?.id) continue;
      quantities.set(node.id, node.inventoryQuantity ?? 0);
    }

    return { quantities, queryFailed: false };
  } catch {
    return { quantities, queryFailed: true };
  }
}

export async function fetchComponentInventoryItemIds(
  admin: GraphqlClient,
  variantIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(variantIds.filter(Boolean))];
  const inventoryItemIds = new Map<string, string>();
  if (uniqueIds.length === 0) return inventoryItemIds;

  try {
    const response = await admin.graphql(
      `#graphql
      query SharedStockVariantInventoryItems($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            inventoryItem {
              id
              legacyResourceId
            }
          }
        }
      }`,
      { variables: { ids: uniqueIds } },
    );
    const json = (await response.json()) as NodesResponse & {
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length) {
      console.error(
        `[SharedStock] Failed to fetch inventory item ids: ${json.errors
          .map((error) => error.message)
          .filter(Boolean)
          .join("; ")}`,
      );
    }

    for (const node of json.data?.nodes ?? []) {
      if (!node?.id) continue;
      const rawId =
        node.inventoryItem?.legacyResourceId ?? node.inventoryItem?.id;
      if (rawId == null) continue;
      inventoryItemIds.set(node.id, toInventoryItemLookupId(rawId));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[SharedStock] Failed to fetch inventory item ids: ${message}`,
    );
  }

  return inventoryItemIds;
}

type LinkWithInventoryItem = {
  bundleVariantId: string;
  componentVariantId: string;
  componentInventoryItemId: string | null;
  quantityNeeded: number;
};

export async function ensureComponentInventoryItemIds<
  T extends LinkWithInventoryItem,
>(admin: GraphqlClient, shop: string, links: T[]): Promise<T[]> {
  const missingVariantIds = [
    ...new Set(
      links
        .filter((link) => !link.componentInventoryItemId)
        .map((link) => link.componentVariantId),
    ),
  ];
  if (missingVariantIds.length === 0) return links;

  const inventoryItemIds = await fetchComponentInventoryItemIds(
    admin,
    missingVariantIds,
  );
  if (inventoryItemIds.size === 0) return links;

  await prisma.$transaction(
    [...inventoryItemIds.entries()].map(
      ([componentVariantId, componentInventoryItemId]) =>
        prisma.bundleLink.updateMany({
          where: {
            shop,
            componentVariantId,
            componentInventoryItemId: null,
          },
          data: { componentInventoryItemId },
        }),
    ),
  );

  return links.map((link) => ({
    ...link,
    componentInventoryItemId:
      link.componentInventoryItemId ??
      inventoryItemIds.get(link.componentVariantId) ??
      null,
  }));
}

export async function withComponentInventoryItemIds(
  admin: GraphqlClient,
  components: Array<{ componentVariantId: string; quantityNeeded: number }>,
): Promise<BundleComponentInput[]> {
  const inventoryItemIds = await fetchComponentInventoryItemIds(
    admin,
    components.map((component) => component.componentVariantId),
  );

  return components.map((component) => ({
    ...component,
    componentInventoryItemId:
      inventoryItemIds.get(component.componentVariantId) ?? null,
  }));
}

export async function findBundleVariantIdsForInventoryItem(
  shop: string,
  componentInventoryItemId: string,
): Promise<string[]> {
  const rows = await prisma.bundleLink.findMany({
    where: { shop, componentInventoryItemId },
    distinct: ["bundleVariantId"],
    select: { bundleVariantId: true },
  });
  return rows.map((row) => row.bundleVariantId);
}

export async function findLinksForBundles(
  shop: string,
  bundleVariantIds: string[],
) {
  if (bundleVariantIds.length === 0) return [];
  return prisma.bundleLink.findMany({
    where: { shop, bundleVariantId: { in: bundleVariantIds } },
  });
}

export async function createBundleLinks(
  shop: string,
  bundleVariantId: string,
  components: BundleComponentInput[],
) {
  await prisma.bundleLink.createMany({
    data: components.map((component) => ({
      shop,
      bundleVariantId,
      componentVariantId: component.componentVariantId,
      componentInventoryItemId: component.componentInventoryItemId ?? null,
      quantityNeeded: component.quantityNeeded,
    })),
  });
}

export async function replaceBundleLinks(
  shop: string,
  previousBundleVariantId: string,
  bundleVariantId: string,
  components: BundleComponentInput[],
) {
  await prisma.$transaction([
    prisma.bundleLink.deleteMany({
      where: { shop, bundleVariantId: previousBundleVariantId },
    }),
    prisma.bundleLink.createMany({
      data: components.map((component) => ({
        shop,
        bundleVariantId,
        componentVariantId: component.componentVariantId,
        componentInventoryItemId: component.componentInventoryItemId ?? null,
        quantityNeeded: component.quantityNeeded,
      })),
    }),
  ]);
}

export async function deleteBundleLinks(shop: string, bundleVariantId: string) {
  await prisma.bundleLink.deleteMany({
    where: { shop, bundleVariantId },
  });
}
