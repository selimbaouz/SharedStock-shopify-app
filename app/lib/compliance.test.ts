import { describe, expect, it } from "vitest";
import {
  orderIdLookupValues,
  parseCustomerDataRequestPayload,
  parseCustomerRedactPayload,
  parseShopRedactPayload,
} from "./compliance";

describe("orderIdLookupValues", () => {
  it("matches numeric and GID forms", () => {
    expect(orderIdLookupValues(299938)).toEqual([
      "299938",
      "gid://shopify/Order/299938",
    ]);
    expect(orderIdLookupValues("gid://shopify/Order/280263")).toEqual([
      "gid://shopify/Order/280263",
      "280263",
    ]);
  });
});

describe("parseShopRedactPayload", () => {
  it("reads the shop domain", () => {
    expect(
      parseShopRedactPayload({
        shop_id: 954889,
        shop_domain: "example.myshopify.com",
      }),
    ).toEqual({ shopDomain: "example.myshopify.com" });
  });
});

describe("parseCustomerRedactPayload", () => {
  it("reads orders to delete", () => {
    expect(
      parseCustomerRedactPayload({
        shop_domain: "example.myshopify.com",
        orders_to_redact: [299938, "280263"],
      }),
    ).toEqual({
      shopDomain: "example.myshopify.com",
      ordersToRedact: ["299938", "280263"],
    });
  });
});

describe("parseCustomerDataRequestPayload", () => {
  it("reads the request id and order ids", () => {
    expect(
      parseCustomerDataRequestPayload({
        shop_domain: "example.myshopify.com",
        orders_requested: [220458],
        data_request: { id: 9999 },
      }),
    ).toEqual({
      shopDomain: "example.myshopify.com",
      dataRequestId: "9999",
      ordersRequested: ["220458"],
    });
  });
});
