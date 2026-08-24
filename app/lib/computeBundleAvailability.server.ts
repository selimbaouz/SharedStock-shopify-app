export type BundleComponentStock = {
  variantId: string;
  availableQuantity: number;
  quantityNeeded: number;
};

export function computeBundleAvailability(
  components: BundleComponentStock[],
): number {
  if (components.length === 0) return 0;

  return Math.min(
    ...components.map((component) =>
      Math.floor(component.availableQuantity / component.quantityNeeded),
    ),
  );
}
