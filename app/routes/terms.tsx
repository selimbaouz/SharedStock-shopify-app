import styles from "../styles/legal.module.css";

export const meta = () => [{ title: "Terms of service — SharedStock" }];

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <p className={styles.nav}>
          <a href="/">SharedStock</a>
          <a href="/privacy">Privacy</a>
        </p>
        <h1>Terms of service</h1>
        <p className={styles.updated}>Last updated: August 30, 2026</p>
        <p>
          These terms govern use of SharedStock, an embedded Shopify app from
          Brandionary. By installing the app, you agree to them.
        </p>

        <h2>What SharedStock does</h2>
        <p>
          SharedStock links a bundle product you already created in Shopify to
          its component products, then keeps displayed pack stock in sync. It
          does not create bundles, change your theme, or process payments.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>
            You configure links correctly (the right pack, products, and
            quantities).
          </li>
          <li>
            You keep Shopify inventory locations and permissions in a state
            that lets the app read and write stock.
          </li>
          <li>
            You remain responsible for your storefront, orders, and refunds.
          </li>
        </ul>

        <h2>Billing</h2>
        <p>
          Paid use is billed through Shopify at $9.99 USD per month, with a
          7-day free trial, as shown on the Shopify App Store listing.
          Shopify handles charges, taxes, and cancellations. Uninstalling the
          app stops future charges according to Shopify&apos;s billing rules.
        </p>

        <h2>Availability</h2>
        <p>
          We aim to keep stock sync running, but we do not guarantee
          uninterrupted service. Shopify API limits, webhook delays, or
          incorrect links can affect stock. Check your links if a pack shows
          an error.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent allowed by law, Brandionary is not liable for lost
          sales, overselling, or other damages arising from use of the app.
          The app is provided as-is for inventory synchronization only.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>
        </p>
      </article>
    </main>
  );
}
