import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { STOCK_CALCULATION_BANNER } from "../lib/help-copy";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function HelpPage() {
  return (
    <s-page heading="Help">
      <s-section heading="What does SharedStock do?">
        <s-paragraph>
          SharedStock syncs inventory between a bundle you already created in
          Shopify and the products you also sell individually. It does not
          create bundles. It stops overselling when a product in the pack runs
          out.
        </s-paragraph>
      </s-section>

      <s-section heading="How is bundle stock calculated?">
        <s-paragraph>{STOCK_CALCULATION_BANNER}</s-paragraph>
      </s-section>

      <s-section heading="How do I create a link?">
        <s-stack gap="base">
          <s-ordered-list>
            <s-list-item>
              Click Create a link, then choose the bundle product.
            </s-list-item>
            <s-list-item>
              Add the products in the pack and how many of each go into one
              bundle.
            </s-list-item>
            <s-list-item>
              Save. The bundle's displayed stock is then recalculated
              automatically.
            </s-list-item>
          </s-ordered-list>
          <s-button href="/app/bundles/new">Create a link</s-button>
        </s-stack>
      </s-section>

      <s-section heading="What happens when something sells?">
        <s-unordered-list>
          <s-list-item>
            Bundle sale: each linked product is deducted (quantity ordered ×
            quantity in the pack).
          </s-list-item>
          <s-list-item>
            Individual sale: the bundle stock is recalculated right away.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="What does the Error badge mean?">
        <s-paragraph>
          A linked product could not be read (deleted, or inventory
          unavailable). Open the link, check the products, then save again.
        </s-paragraph>
      </s-section>

      <s-section heading="What is quantity needed?">
        <s-paragraph>
          How many units of that product go into one bundle. A pack of 2 red
          tees and 1 yellow tee needs 2 and 1.
        </s-paragraph>
      </s-section>

      <s-section heading="Support">
        <s-paragraph>
          Something not working, or a question about your store? Email us and
          we'll help.
        </s-paragraph>
        <s-paragraph>
          <s-link href="mailto:hello@brandionary.com">
            hello@brandionary.com
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-link href="/privacy" target="_blank">
            Privacy policy
          </s-link>
          {" · "}
          <s-link href="/terms" target="_blank">
            Terms
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
