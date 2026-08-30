import { describe, expect, it } from "vitest";
import {
  aggregateDeltasByInventoryItem,
  buildAdjustComponentQuantityInput,
  parseOrderCreatePayload,
  planComponentDeductions,
} from "./process-order.server";

describe("parseOrderCreatePayload", () => {
  it("reads order id, location, and line items", () => {
    expect(
      parseOrderCreatePayload({
        id: 1234567890,
        location_id: 69128716450,
        line_items: [
          { variant_id: 43242331111485, quantity: 2 },
          { variant_id: null, quantity: 1 },
        ],
      }),
    ).toEqual({
      orderId: "1234567890",
      locationId: "69128716450",
      lineItems: [{ variantId: "43242331111485", quantity: 2 }],
    });
  });
});

describe("planComponentDeductions", () => {
  const links = [
    {
      bundleVariantId: "gid://shopify/ProductVariant/100",
      componentVariantId: "gid://shopify/ProductVariant/blue",
      componentInventoryItemId: "11",
      quantityNeeded: 1,
    },
    {
      bundleVariantId: "gid://shopify/ProductVariant/100",
      componentVariantId: "gid://shopify/ProductVariant/pink",
      componentInventoryItemId: "22",
      quantityNeeded: 2,
    },
  ];

  it("deducts quantityNeeded times the ordered bundle quantity", () => {
    expect(
      planComponentDeductions(
        [{ variantId: "100", quantity: 3 }],
        links,
      ).deductions.map((deduction) => ({
        componentInventoryItemId: deduction.componentInventoryItemId,
        delta: deduction.delta,
      })),
    ).toEqual([
      { componentInventoryItemId: "11", delta: -3 },
      { componentInventoryItemId: "22", delta: -6 },
    ]);
  });

  it("ignores line items that are not known bundles", () => {
    expect(
      planComponentDeductions(
        [{ variantId: "999", quantity: 1 }],
        links,
      ).deductions,
    ).toEqual([]);
  });

  it("skips components until their inventory item id is known", () => {
    expect(
      planComponentDeductions([{ variantId: "100", quantity: 1 }], [
        { ...links[0], componentInventoryItemId: null },
        links[1],
      ]),
    ).toEqual({
      deductions: [
        {
          bundleVariantId: "gid://shopify/ProductVariant/100",
          bundleQuantity: 1,
          componentVariantId: "gid://shopify/ProductVariant/pink",
          componentInventoryItemId: "22",
          quantityNeeded: 2,
          delta: -2,
        },
      ],
      skipped: ["gid://shopify/ProductVariant/blue"],
    });
  });
});

describe("buildAdjustComponentQuantityInput", () => {
  it("opts out of compare-and-swap with an explicit null changeFromQuantity", () => {
    expect(
      buildAdjustComponentQuantityInput({
        locationId: "gid://shopify/Location/2",
        orderId: "123",
        deltas: new Map([["gid://shopify/InventoryItem/11", -3]]),
      }),
    ).toEqual({
      name: "available",
      reason: "correction",
      referenceDocumentUri: "gid://shopify/Order/123",
      changes: [
        {
          inventoryItemId: "gid://shopify/InventoryItem/11",
          locationId: "gid://shopify/Location/2",
          delta: -3,
          changeFromQuantity: null,
        },
      ],
    });
  });
});

describe("aggregateDeltasByInventoryItem", () => {
  it("sums deltas when the same component is used by two sold bundles", () => {
    const deltas = aggregateDeltasByInventoryItem([
      {
        bundleVariantId: "bundle-a",
        bundleQuantity: 1,
        componentVariantId: "blue",
        componentInventoryItemId: "11",
        quantityNeeded: 1,
        delta: -1,
      },
      {
        bundleVariantId: "bundle-b",
        bundleQuantity: 2,
        componentVariantId: "blue",
        componentInventoryItemId: "11",
        quantityNeeded: 1,
        delta: -2,
      },
    ]);

    expect(deltas.get("gid://shopify/InventoryItem/11")).toBe(-3);
  });
});
