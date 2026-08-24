export const BUNDLE_AS_COMPONENT_ERROR =
  "The bundle can't also be selected as one of its products";

export type PickedProduct = {
  id: string;
  title: string;
  variants?: Array<{ id?: string; title?: string | null } | null> | null;
};

export type SelectedVariant = {
  productId: string;
  title: string;
  variantId: string;
  variantTitle?: string;
};

export type SelectedComponent = SelectedVariant & { quantity: number };

export function toSelectedVariant(product: PickedProduct): SelectedVariant | null {
  const variant = product.variants?.find((item) => item?.id);
  if (!variant?.id) return null;

  return {
    productId: product.id,
    title: product.title,
    variantId: variant.id,
    variantTitle: variant.title ?? undefined,
  };
}

export function parseQuantity(value: FormDataEntryValue | undefined): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.floor(quantity);
}

export function isSameProductAsBundle(
  picked: SelectedVariant,
  bundle: SelectedVariant | null,
): boolean {
  if (!bundle) return false;
  return (
    picked.variantId === bundle.variantId || picked.productId === bundle.productId
  );
}

export function formatVariantLabel(
  title: string,
  variantTitle?: string | null,
): string {
  if (!variantTitle || variantTitle === "Default Title") return title;
  return `${title} — ${variantTitle}`;
}

export function parseBundleLinkForm(formData: FormData) {
  const bundleVariantId = String(formData.get("bundleVariantId") ?? "").trim();
  const previousBundleVariantId = String(
    formData.get("previousBundleVariantId") ?? "",
  ).trim();
  const componentVariantIds = formData
    .getAll("componentVariantId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const quantities = formData.getAll("quantityNeeded");

  if (!bundleVariantId) {
    return { error: "Select a bundle product." } as const;
  }

  if (componentVariantIds.length === 0) {
    return { error: "Select at least one product." } as const;
  }

  if (componentVariantIds.includes(bundleVariantId)) {
    return { error: BUNDLE_AS_COMPONENT_ERROR } as const;
  }

  return {
    bundleVariantId,
    previousBundleVariantId: previousBundleVariantId || undefined,
    components: componentVariantIds.map((componentVariantId, index) => ({
      componentVariantId,
      quantityNeeded: parseQuantity(quantities[index]),
    })),
  } as const;
}
