import { computeBundleAvailability } from "./computeBundleAvailability.server";
import {
  findBundleVariantIdsForInventoryItem,
  findLinksForBundles,
} from "./bundle-links.server";
import { toShopifyGid } from "./shopify-ids";

export { toShopifyGid };

type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphqlErrorBody = {
  errors?: Array<{ message?: string }>;
};

type VariantInventoryNode = {
  id?: string;
  inventoryItem?: {
    id?: string;
    inventoryLevel?: {
      quantities?: Array<{ name?: string; quantity?: number | null } | null>;
    } | null;
  } | null;
};

type NodesInventoryResponse = {
  data?: {
    nodes?: Array<VariantInventoryNode | null>;
  };
} & GraphqlErrorBody;

type SetQuantitiesResponse = {
  data?: {
    inventorySetQuantities?: {
      userErrors?: Array<{ field?: string[] | null; message?: string }>;
    } | null;
  };
} & GraphqlErrorBody;

export type BundleLinkRow = {
  bundleVariantId: string;
  componentVariantId: string;
  quantityNeeded: number;
};

export type BundleAvailabilityPlan =
  | { bundleVariantId: string; quantity: number }
  | { bundleVariantId: string; error: string };

export function parseInventoryUpdatePayload(payload: Record<string, unknown>): {
  inventoryItemId: string | null;
  locationId: string | null;
} {
  const inventoryItemId =
    payload.inventory_item_id == null
      ? null
      : String(payload.inventory_item_id).trim();
  const locationId =
    payload.location_id == null ? null : String(payload.location_id).trim();

  return {
    inventoryItemId: inventoryItemId || null,
    locationId: locationId || null,
  };
}

export function planBundleAvailabilityUpdates(
  bundleVariantIds: string[],
  links: BundleLinkRow[],
  quantities: Map<string, number>,
): BundleAvailabilityPlan[] {
  const byBundle = new Map<string, BundleLinkRow[]>();
  for (const link of links) {
    const group = byBundle.get(link.bundleVariantId) ?? [];
    group.push(link);
    byBundle.set(link.bundleVariantId, group);
  }

  return bundleVariantIds.map((bundleVariantId) => {
    const components = byBundle.get(bundleVariantId) ?? [];
    const missing = components.find(
      (component) => !quantities.has(component.componentVariantId),
    );
    if (missing) {
      return {
        bundleVariantId,
        error: `Missing inventory for component ${missing.componentVariantId}`,
      };
    }

    return {
      bundleVariantId,
      quantity: computeBundleAvailability(
        components.map((component) => ({
          variantId: component.componentVariantId,
          availableQuantity:
            quantities.get(component.componentVariantId) ?? 0,
          quantityNeeded: component.quantityNeeded,
        })),
      ),
    };
  });
}

function availableQuantity(
  node: VariantInventoryNode | null | undefined,
): number | undefined {
  if (!node?.id) return undefined;
  const quantities = node.inventoryItem?.inventoryLevel?.quantities ?? [];
  const available = quantities.find((entry) => entry?.name === "available");
  if (available?.quantity == null) return 0;
  return available.quantity;
}

async function readGraphqlJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function graphqlErrorMessage(json: GraphqlErrorBody): string | null {
  if (!json.errors?.length) return null;
  return json.errors
    .map((error) => error.message)
    .filter(Boolean)
    .join("; ");
}

async function resolveFallbackLocationId(
  admin: GraphqlClient,
  inventoryItemGid: string,
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    query SharedStockInventoryItemLocation($id: ID!) {
      inventoryItem(id: $id) {
        inventoryLevels(first: 1) {
          nodes {
            location {
              id
            }
          }
        }
      }
    }`,
    { variables: { id: inventoryItemGid } },
  );
  const json = await readGraphqlJson<{
    data?: {
      inventoryItem?: {
        inventoryLevels?: {
          nodes?: Array<{ location?: { id?: string } | null } | null>;
        } | null;
      } | null;
    };
  } & GraphqlErrorBody>(response);
  const error = graphqlErrorMessage(json);
  if (error) {
    throw new Error(error);
  }
  return (
    json.data?.inventoryItem?.inventoryLevels?.nodes?.[0]?.location?.id ?? null
  );
}

async function fetchVariantInventoryAtLocation(
  admin: GraphqlClient,
  variantIds: string[],
  locationGid: string,
): Promise<Map<string, VariantInventoryNode>> {
  const uniqueIds = [...new Set(variantIds.filter(Boolean))];
  const nodes = new Map<string, VariantInventoryNode>();
  if (uniqueIds.length === 0) return nodes;

  const response = await admin.graphql(
    `#graphql
    query SharedStockVariantInventoryAtLocation($ids: [ID!]!, $locationId: ID!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          inventoryItem {
            id
            inventoryLevel(locationId: $locationId) {
              quantities(names: ["available"]) {
                name
                quantity
              }
            }
          }
        }
      }
    }`,
    { variables: { ids: uniqueIds, locationId: locationGid } },
  );
  const json = await readGraphqlJson<NodesInventoryResponse>(response);
  const error = graphqlErrorMessage(json);
  if (error) {
    throw new Error(error);
  }

  for (const node of json.data?.nodes ?? []) {
    if (!node?.id) continue;
    nodes.set(node.id, node);
  }

  return nodes;
}

async function setBundleAvailableQuantity(
  admin: GraphqlClient,
  inventoryItemId: string,
  locationGid: string,
  quantity: number,
): Promise<void> {
  const response = await admin.graphql(
    `#graphql
    mutation SharedStockSetBundleQuantity($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
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
          ignoreCompareQuantity: true,
          quantities: [
            {
              inventoryItemId,
              locationId: locationGid,
              quantity,
            },
          ],
        },
      },
    },
  );
  const json = await readGraphqlJson<SetQuantitiesResponse>(response);
  const error = graphqlErrorMessage(json);
  if (error) {
    throw new Error(error);
  }

  const userErrors =
    json.data?.inventorySetQuantities?.userErrors?.filter(
      (entry) => entry.message,
    ) ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((entry) => entry.message).join("; "));
  }
}

export async function syncBundlesForInventoryUpdate(options: {
  admin: GraphqlClient;
  shop: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { admin, shop, payload } = options;
  const parsed = parseInventoryUpdatePayload(payload);
  if (!parsed.inventoryItemId) {
    console.error(
      `[SharedStock] inventory_levels/update ignored for ${shop}: missing inventory_item_id`,
    );
    return;
  }

  const bundleVariantIds = await findBundleVariantIdsForInventoryItem(
    shop,
    parsed.inventoryItemId,
  );
  if (bundleVariantIds.length === 0) {
    return;
  }

  const locationGid = parsed.locationId
    ? toShopifyGid("Location", parsed.locationId)
    : await resolveFallbackLocationId(
        admin,
        toShopifyGid("InventoryItem", parsed.inventoryItemId),
      );
  if (!locationGid) {
    console.error(
      `[SharedStock] inventory_levels/update for inventory item ${parsed.inventoryItemId} on ${shop} has no location; cannot set bundle stock`,
    );
    return;
  }
  const links = await findLinksForBundles(shop, bundleVariantIds);
  const variantIdsToFetch = [
    ...new Set([
      ...links.map((link) => link.componentVariantId),
      ...bundleVariantIds,
    ]),
  ];
  const inventoryNodes = await fetchVariantInventoryAtLocation(
    admin,
    variantIdsToFetch,
    locationGid,
  );

  const componentQuantities = new Map<string, number>();
  for (const link of links) {
    const quantity = availableQuantity(
      inventoryNodes.get(link.componentVariantId),
    );
    if (quantity == null) continue;
    componentQuantities.set(link.componentVariantId, quantity);
  }

  const plans = planBundleAvailabilityUpdates(
    bundleVariantIds,
    links,
    componentQuantities,
  );

  for (const plan of plans) {
    if ("error" in plan) {
      console.error(
        `[SharedStock] Failed to sync bundle ${plan.bundleVariantId} on ${shop}: ${plan.error}`,
      );
      continue;
    }

    const bundleNode = inventoryNodes.get(plan.bundleVariantId);
    const inventoryItemId = bundleNode?.inventoryItem?.id;
    if (!inventoryItemId) {
      console.error(
        `[SharedStock] Failed to sync bundle ${plan.bundleVariantId} on ${shop}: bundle inventory item not found`,
      );
      continue;
    }

    const previousQuantity = availableQuantity(bundleNode) ?? 0;
    const nextQuantity = Math.max(0, plan.quantity);

    if (previousQuantity === nextQuantity) {
      console.log(
        `[SharedStock] Bundle ${plan.bundleVariantId} already at ${nextQuantity} on ${shop}`,
      );
      continue;
    }

    try {
      await setBundleAvailableQuantity(
        admin,
        inventoryItemId,
        locationGid,
        nextQuantity,
      );
      console.log(
        `[SharedStock] Synced bundle ${plan.bundleVariantId} on ${shop}: ${previousQuantity} → ${nextQuantity}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[SharedStock] Failed to sync bundle ${plan.bundleVariantId} on ${shop}: ${message}`,
      );
    }
  }
}
