import { useRef, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  BUNDLE_AS_COMPONENT_ERROR,
  formatVariantLabel,
  isSameProductAsBundle,
  toSelectedVariant,
  type PickedProduct,
  type SelectedComponent,
  type SelectedVariant,
} from "../lib/bundle-form";
import { STOCK_CALCULATION_BANNER } from "../lib/help-copy";

type BundleLinkFormProps = {
  heading: string;
  initialBundle?: SelectedVariant | null;
  initialComponents?: SelectedComponent[];
  previousBundleVariantId?: string;
};

export function BundleLinkForm({
  heading,
  initialBundle = null,
  initialComponents = [],
  previousBundleVariantId,
}: BundleLinkFormProps) {
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const actionData = useActionData<{ error?: string }>();
  const formRef = useRef<HTMLFormElement>(null);

  const [bundle, setBundle] = useState<SelectedVariant | null>(initialBundle);
  const [components, setComponents] =
    useState<SelectedComponent[]>(initialComponents);
  const [error, setError] = useState<string | null>(null);

  const isSaving = navigation.state === "submitting";
  const bannerError = error ?? actionData?.error ?? null;

  const pickBundle = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
      filter: { variants: true },
      selectionIds: bundle?.productId
        ? [{ id: bundle.productId, variants: [{ id: bundle.variantId }] }]
        : [],
    });

    const product = selected?.[0] as PickedProduct | undefined;
    if (!product) return;

    const next = toSelectedVariant(product);
    if (!next) {
      shopify.toast.show("This product has no usable variant.");
      return;
    }

    setBundle(next);
    setComponents((current) =>
      current.filter((component) => component.productId !== next.productId),
    );
    setError(null);
  };

  const pickComponents = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
      filter: { variants: true },
      selectionIds: components
        .filter(
          (component) =>
            Boolean(component.productId) &&
            component.productId !== bundle?.productId,
        )
        .map((component) => ({
          id: component.productId,
          variants: [{ id: component.variantId }],
        })),
    });

    if (!selected) return;

    const quantitiesByVariant = new Map(
      components.map((component) => [component.variantId, component.quantity]),
    );

    const nextComponents: SelectedComponent[] = [];
    let pickedBundleAsComponent = false;

    for (const item of selected as PickedProduct[]) {
      const picked = toSelectedVariant(item);
      if (!picked) continue;
      if (isSameProductAsBundle(picked, bundle)) {
        pickedBundleAsComponent = true;
        continue;
      }
      if (
        nextComponents.some((component) => component.variantId === picked.variantId)
      ) {
        continue;
      }

      nextComponents.push({
        ...picked,
        quantity: quantitiesByVariant.get(picked.variantId) ?? 1,
      });
    }

    setComponents(nextComponents);
    setError(pickedBundleAsComponent ? BUNDLE_AS_COMPONENT_ERROR : null);
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    setComponents((current) =>
      current.map((component) =>
        component.variantId === variantId
          ? {
              ...component,
              quantity:
                Number.isFinite(quantity) && quantity >= 1
                  ? Math.floor(quantity)
                  : 1,
            }
          : component,
      ),
    );
  };

  return (
    <s-page heading={heading}>
      <s-link slot="breadcrumb-actions" href="/app">
        Bundles
      </s-link>
      <s-button
        slot="primary-action"
        variant="primary"
        loading={isSaving || undefined}
        onClick={() => formRef.current?.requestSubmit()}
      >
        Save
      </s-button>

      <s-banner tone="info">{STOCK_CALCULATION_BANNER}</s-banner>

      <Form
        ref={formRef}
        method="post"
        onSubmit={(event) => {
          if (components.length === 0) {
            event.preventDefault();
            setError("Select at least one product.");
            return;
          }
          if (
            bundle &&
            components.some(
              (component) => component.variantId === bundle.variantId,
            )
          ) {
            event.preventDefault();
            setError(BUNDLE_AS_COMPONENT_ERROR);
          }
        }}
      >
        {previousBundleVariantId ? (
          <input
            type="hidden"
            name="previousBundleVariantId"
            value={previousBundleVariantId}
          />
        ) : null}
        {bundle ? (
          <input type="hidden" name="bundleVariantId" value={bundle.variantId} />
        ) : null}

        {bannerError ? (
          <s-banner tone="critical" heading="Couldn't save">
            {bannerError}
          </s-banner>
        ) : null}

        <s-section heading="Bundle product">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              The pack already created in Shopify (Shopify Bundles app or a
              manual product). SharedStock does not create this product — it
              only links its inventory to the other products.
            </s-paragraph>
            <s-paragraph>
              {bundle
                ? formatVariantLabel(bundle.title, bundle.variantTitle)
                : "No product selected"}
            </s-paragraph>
            <s-button type="button" onClick={pickBundle}>
              {bundle ? "Change bundle" : "Choose bundle"}
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Products">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Products also sold individually. Quantity needed is how many units
              of that product go into one pack.
            </s-paragraph>
            <s-button type="button" onClick={pickComponents}>
              {components.length > 0 ? "Change products" : "Choose products"}
            </s-button>

            {components.map((component) => (
              <s-stack key={component.variantId} direction="block" gap="small-200">
                <input
                  type="hidden"
                  name="componentVariantId"
                  value={component.variantId}
                />
                <s-paragraph>
                  {formatVariantLabel(component.title, component.variantTitle)}
                </s-paragraph>
                <s-number-field
                  label="Quantity needed"
                  name="quantityNeeded"
                  value={String(component.quantity)}
                  min={1}
                  step={1}
                  onChange={(event) =>
                    updateQuantity(
                      component.variantId,
                      Number(event.currentTarget.value),
                    )
                  }
                />
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      </Form>
    </s-page>
  );
}
