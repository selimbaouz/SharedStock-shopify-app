import { describe, expect, it } from "vitest";
import { computeBundleAvailability } from "./computeBundleAvailability.server";

describe("computeBundleAvailability", () => {
  it("returns stock when a single component needs 1 unit", () => {
    expect(
      computeBundleAvailability([
        { variantId: "blue", availableQuantity: 10, quantityNeeded: 1 },
      ]),
    ).toBe(10);
  });

  it("returns the minimum across components (limiting component)", () => {
    expect(
      computeBundleAvailability([
        { variantId: "blue", availableQuantity: 6, quantityNeeded: 1 },
        { variantId: "pink", availableQuantity: 10, quantityNeeded: 1 },
      ]),
    ).toBe(6);
  });

  it("floors stock divided by quantityNeeded", () => {
    expect(
      computeBundleAvailability([
        { variantId: "blue", availableQuantity: 9, quantityNeeded: 3 },
      ]),
    ).toBe(3);
  });

  it("returns 0 when there are no components", () => {
    expect(computeBundleAvailability([])).toBe(0);
  });
});
