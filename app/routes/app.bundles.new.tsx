import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BundleLinkForm } from "../components/BundleLinkForm";
import { parseBundleLinkForm } from "../lib/bundle-form";
import {
  createBundleLinks,
  withComponentInventoryItemIds,
} from "../lib/bundle-links.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const parsed = parseBundleLinkForm(await request.formData());
  if ("error" in parsed) return parsed;

  await createBundleLinks(
    session.shop,
    parsed.bundleVariantId,
    await withComponentInventoryItemIds(admin, parsed.components),
  );

  return redirect("/app");
};

export default function NewBundleLink() {
  return <BundleLinkForm heading="Create a link" />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
