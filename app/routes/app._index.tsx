import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { HowItWorks } from "../components/HowItWorks";
import {
  deleteBundleLinks,
  ensureComponentInventoryItemIds,
  fetchVariantDetails,
  fetchVariantInventory,
} from "../lib/bundle-links.server";
import { computeBundleAvailability } from "../lib/computeBundleAvailability.server";
import {
  EMPTY_STATE_COPY,
  STOCK_CALCULATION_TOOLTIP,
} from "../lib/help-copy";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const links = await ensureComponentInventoryItemIds(
    admin,
    session.shop,
    await prisma.bundleLink.findMany({
      where: { shop: session.shop },
    }),
  );

  const grouped = new Map<
    string,
    Array<{ componentVariantId: string; quantityNeeded: number }>
  >();
  for (const link of links) {
    const components = grouped.get(link.bundleVariantId) ?? [];
    components.push({
      componentVariantId: link.componentVariantId,
      quantityNeeded: link.quantityNeeded,
    });
    grouped.set(link.bundleVariantId, components);
  }

  const bundleVariantIds = [...grouped.keys()];
  const componentVariantIds = [
    ...new Set(links.map((link) => link.componentVariantId)),
  ];

  const details = await fetchVariantDetails(admin, bundleVariantIds);
  const { quantities, queryFailed } = await fetchVariantInventory(
    admin,
    componentVariantIds,
  );

  const bundles = bundleVariantIds.map((bundleVariantId) => {
    const components = grouped.get(bundleVariantId) ?? [];
    const missingComponent = components.some(
      (component) => !quantities.has(component.componentVariantId),
    );

    return {
      bundleVariantId,
      title: details.get(bundleVariantId)?.label ?? bundleVariantId,
      componentCount: components.length,
      calculatedStock:
        queryFailed || missingComponent
          ? null
          : computeBundleAvailability(
              components.map((component) => ({
                variantId: component.componentVariantId,
                availableQuantity:
                  quantities.get(component.componentVariantId) ?? 0,
                quantityNeeded: component.quantityNeeded,
              })),
            ),
    };
  });

  return { bundles };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("intent") !== "delete") {
    return { deleted: false };
  }

  const bundleVariantId = String(formData.get("bundleVariantId") ?? "").trim();
  if (!bundleVariantId) {
    return { deleted: false };
  }

  await deleteBundleLinks(session.shop, bundleVariantId);
  return { deleted: true };
};

export default function BundlesIndex() {
  const { bundles } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [pendingDelete, setPendingDelete] = useState<{
    bundleVariantId: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (fetcher.data?.deleted && fetcher.state === "idle") {
      shopify.toast.show("Link deleted");
      setPendingDelete(null);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const isDeleting = fetcher.state !== "idle";

  return (
    <s-page heading="Bundles">
      <s-button slot="primary-action" variant="primary" href="/app/bundles/new">
        Create a link
      </s-button>
      <s-button slot="secondary-actions" href="/app/help">
        How it works
      </s-button>

      {bundles.length === 0 ? (
        <>
          <s-section>
            <s-stack gap="base">
              <s-paragraph>{EMPTY_STATE_COPY}</s-paragraph>
              <s-button variant="primary" href="/app/bundles/new">
                Create a link
              </s-button>
            </s-stack>
          </s-section>
          <HowItWorks />
        </>
      ) : (
        <s-section padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Bundle</s-table-header>
              <s-table-header listSlot="labeled">Products</s-table-header>
              <s-table-header listSlot="labeled">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  Available stock (calculated)
                  <s-icon
                    type="info"
                    tone="info"
                    interestFor="stock-calculation-tooltip"
                  />
                  <s-tooltip id="stock-calculation-tooltip">
                    {STOCK_CALCULATION_TOOLTIP}
                  </s-tooltip>
                </s-stack>
              </s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
              <s-table-header listSlot="labeled">Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {bundles.map((bundle) => (
                <s-table-row key={bundle.bundleVariantId}>
                  <s-table-cell>{bundle.title}</s-table-cell>
                  <s-table-cell>{bundle.componentCount}</s-table-cell>
                  <s-table-cell>
                    {bundle.calculatedStock === null ? (
                      <s-badge tone="critical">Error</s-badge>
                    ) : (
                      bundle.calculatedStock
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="success">Active</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      <s-button
                        variant="tertiary"
                        icon="edit"
                        accessibilityLabel="Edit"
                        href={`/app/bundles/${encodeURIComponent(bundle.bundleVariantId)}`}
                      />
                      <s-button
                        type="button"
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        accessibilityLabel="Delete"
                        commandFor="delete-bundle-modal"
                        command="--show"
                        disabled={isDeleting || undefined}
                        onClick={() =>
                          setPendingDelete({
                            bundleVariantId: bundle.bundleVariantId,
                            title: bundle.title,
                          })
                        }
                      />
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-modal id="delete-bundle-modal" heading="Delete this link?">
        <s-paragraph>
          {pendingDelete
            ? `The link “${pendingDelete.title}” and all of its products will be removed.`
            : "This link and all of its products will be removed."}
        </s-paragraph>
        <s-button
          slot="secondary-actions"
          commandFor="delete-bundle-modal"
          command="--hide"
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-bundle-modal"
          command="--hide"
          loading={isDeleting || undefined}
          disabled={!pendingDelete || isDeleting || undefined}
          onClick={() => {
            if (!pendingDelete) return;
            const data = new FormData();
            data.set("intent", "delete");
            data.set("bundleVariantId", pendingDelete.bundleVariantId);
            fetcher.submit(data, { method: "POST" });
          }}
        >
          Delete
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
