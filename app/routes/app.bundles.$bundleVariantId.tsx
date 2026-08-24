import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BundleLinkForm } from "../components/BundleLinkForm";
import { parseBundleLinkForm } from "../lib/bundle-form";
import {
  fetchVariantDetails,
  replaceBundleLinks,
  withComponentInventoryItemIds,
} from "../lib/bundle-links.server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const bundleVariantId = decodeURIComponent(params.bundleVariantId ?? "");

  const links = await prisma.bundleLink.findMany({
    where: { shop: session.shop, bundleVariantId },
    orderBy: { createdAt: "asc" },
  });

  if (links.length === 0) {
    throw new Response("Link not found", { status: 404 });
  }

  const details = await fetchVariantDetails(admin, [
    bundleVariantId,
    ...links.map((link) => link.componentVariantId),
  ]);

  const bundleDetails = details.get(bundleVariantId);
  const initialBundle = {
    productId: bundleDetails?.productId ?? "",
    title: bundleDetails?.title ?? bundleVariantId,
    variantId: bundleVariantId,
    variantTitle: bundleDetails?.variantTitle,
  };

  const initialComponents = links.map((link) => {
    const componentDetails = details.get(link.componentVariantId);
    return {
      productId: componentDetails?.productId ?? "",
      title: componentDetails?.title ?? link.componentVariantId,
      variantId: link.componentVariantId,
      variantTitle: componentDetails?.variantTitle,
      quantity: link.quantityNeeded,
    };
  });

  return { bundleVariantId, initialBundle, initialComponents };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const previousBundleVariantId = decodeURIComponent(
    params.bundleVariantId ?? "",
  );
  const parsed = parseBundleLinkForm(await request.formData());
  if ("error" in parsed) return parsed;

  await replaceBundleLinks(
    session.shop,
    parsed.previousBundleVariantId ?? previousBundleVariantId,
    parsed.bundleVariantId,
    await withComponentInventoryItemIds(admin, parsed.components),
  );

  return redirect("/app");
};

export default function EditBundleLink() {
  const { bundleVariantId, initialBundle, initialComponents } =
    useLoaderData<typeof loader>();

  return (
    <BundleLinkForm
      heading="Edit link"
      previousBundleVariantId={bundleVariantId}
      initialBundle={initialBundle}
      initialComponents={initialComponents}
    />
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
