import { describe, expect, it } from "vitest";
import { toInventoryItemLookupId } from "./shopify-ids";
import {
  buildSetBundleQuantityInput,
  parseInventoryUpdatePayload,
  planBundleAvailabilityUpdates,
  toShopifyGid,
} from "./sync-bundle-inventory.server";

describe("toInventoryItemLookupId", () => {
  it("keeps the webhook REST id unchanged", () => {
    expect(toInventoryItemLookupId(48365093355682)).toBe("48365093355682");
  });

  it("strips an InventoryItem GID down to the REST id", () => {
    expect(
      toInventoryItemLookupId("gid://shopify/InventoryItem/48365093355682"),
    ).toBe("48365093355682");
  });
});

describe("toShopifyGid", () => {
  it("builds a GID from a numeric REST id", () => {
    expect(toShopifyGid("InventoryItem", 48365093355682)).toBe(
      "gid://shopify/InventoryItem/48365093355682",
    );
  });

  it("leaves an existing GID unchanged", () => {
    expect(
      toShopifyGid("Location", "gid://shopify/Location/69128716450"),
    ).toBe("gid://shopify/Location/69128716450");
  });
});

describe("parseInventoryUpdatePayload", () => {
  it("reads inventory_item_id and location_id", () => {
    expect(
      parseInventoryUpdatePayload({
        inventory_item_id: 48365093355682,
        location_id: 69128716450,
        available: 32,
      }),
    ).toEqual({
      inventoryItemId: "48365093355682",
      locationId: "69128716450",
    });
  });

  it("returns nulls when ids are missing", () => {
    expect(parseInventoryUpdatePayload({})).toEqual({
      inventoryItemId: null,
      locationId: null,
    });
  });
});

describe("buildSetBundleQuantityInput", () => {
  it("uses changeFromQuantity instead of the removed compare-and-swap fields", () => {
    expect(
      buildSetBundleQuantityInput({
        inventoryItemId: "gid://shopify/InventoryItem/1",
        locationId: "gid://shopify/Location/2",
        quantity: 6,
        changeFromQuantity: 10,
      }),
    ).toEqual({
      name: "available",
      reason: "correction",
      quantities: [
        {
          inventoryItemId: "gid://shopify/InventoryItem/1",
          locationId: "gid://shopify/Location/2",
          quantity: 6,
          changeFromQuantity: 10,
        },
      ],
    });
  });
});

describe("planBundleAvailabilityUpdates", () => {
  const links = [
    {
      bundleVariantId: "bundle-duo",
      componentVariantId: "blue",
      quantityNeeded: 1,
    },
    {
      bundleVariantId: "bundle-duo",
      componentVariantId: "pink",
      quantityNeeded: 1,
    },
    {
      bundleVariantId: "bundle-trio",
      componentVariantId: "blue",
      quantityNeeded: 2,
    },
  ];

  it("computes availability for every affected bundle from all components", () => {
    const quantities = new Map([
      ["blue", 6],
      ["pink", 10],
    ]);

    expect(
      planBundleAvailabilityUpdates(
        ["bundle-duo", "bundle-trio"],
        links,
        quantities,
      ),
    ).toEqual([
      { bundleVariantId: "bundle-duo", quantity: 6 },
      { bundleVariantId: "bundle-trio", quantity: 3 },
    ]);
  });

  it("marks only the bundle whose component stock is missing", () => {
    const quantities = new Map([["blue", 6]]);

    expect(
      planBundleAvailabilityUpdates(
        ["bundle-duo", "bundle-trio"],
        links,
        quantities,
      ),
    ).toEqual([
      {
        bundleVariantId: "bundle-duo",
        error: "Missing inventory for component pink",
      },
      { bundleVariantId: "bundle-trio", quantity: 3 },
    ]);
  });
});
