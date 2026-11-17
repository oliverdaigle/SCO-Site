# Going live with Lotwise

This guide takes Lotwise from the demo to a real website that takes real payments. You do not need to write code. You will create a few accounts, copy keys from one website into another, and click Deploy. Plan on about two hours, most of it waiting for email verification and DNS.

Until you add keys, the site runs in **demo mode**: everything works, sign-in and payments are simulated, and a banner says so. Each key you add switches on one real service. You can stop at any step and the site keeps working.

## What it costs

| Service | What it does | Cost |
|---|---|---|
| Domain (any registrar) | Your web address | About $10 to $60 a year. `.com` is cheapest, `.io` costs more. |
| Vercel Pro | Hosts the website | $20 a month. The free Hobby plan does not allow commercial sites, and Lotwise charges money. |
| Supabase | Accounts and database | Free to start. Pro is $25 a month and recommended at launch: free projects pause after a week without visitors, and Pro adds daily backups. |
| Email provider (for sign-in links) | Sends magic-link emails | Free tiers cover a small launch (Resend, Postmark, SendGrid, Brevo all work). |
| Stripe | Payments | No monthly fee. About 2.9% + 30¢ per card payment, plus 0.7% on subscription payments. You keep about $11.27 of a $12 subscription, $4.52 of a $5 subscription, and $14.27 of the $15 semester pass. |
| Anthropic (optional) | AI reader for Paste Your Problem | Pay as you go, roughly 1 to 2 cents per pasted problem. Without a key, the built-in reader is used for free. |

Fixed costs at launch: about **$45 a month** plus the domain. Prices change; check each provider's pricing page.

## The keys, and where each one goes

You will paste these into Vercel in step 5. Keep them in a password manager as you collect them. Never paste a secret key into a chat, an email, or the code.

| Name in Vercel | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your domain, like `https://lotwise.io` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, step 2 | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **publishable** key (older projects call it the `anon` key), step 2 | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret** key (older projects call it the `service_role` key), step 2 | **Yes** |
| `STRIPE_SECRET_KEY` | Stripe, step 3 | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret, step 6 | **Yes** |
| `ANTHROPIC_API_KEY` | Anthropic, step 4 (optional) | **Yes** |
| `ADMIN_EMAILS` | Your own email address (comma-separate several) | No |
| `STRIPE_PRICE_BUSINESS_MONTHLY`, `STRIPE_PRICE_LEARNER_MONTHLY`, `STRIPE_PRICE_LEARNER_SEMESTER` | Optional. Leave empty and Lotwise tells Stripe the prices itself. | No |

The full list with comments is in `.env.example`.

---

## Step 1. Name the main branch (optional, two minutes)

The finished code is on the branch `claude/supply-chain-calculator-v6snz1` of your GitHub repository `oliverdaigle/SCO-Site`. It is the repository's only branch, so it is already the default branch, and Vercel will deploy it as is.

If you would like the conventional name `main`: open the repository on GitHub, go to **Settings**, then **General**, find **Default branch**, click the pencil icon, rename it to `main`, and confirm. GitHub redirects the old name, and Vercel follows the default branch. Every change to the default branch deploys automatically once step 5 is done.

## Step 2. Supabase (accounts and database)

1. Go to **supabase.com**, sign up with GitHub, and click **New project**. Name it `lotwise`, pick a strong database password (save it), and choose the region closest to most of your users. Wait a minute or two while it starts.
2. **Create the tables.** In the left sidebar open **SQL Editor**, click **New query**, open the file `supabase/migrations/0001_init.sql` from your repository on GitHub, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned". It is safe to run again.
3. **Copy the keys.** Open **Project Settings**, then **API Keys**. Copy the **publishable** key into your notes as `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the **secret** key as `SUPABASE_SERVICE_ROLE_KEY`. (If you only see `anon` and `service_role`, those are the same thing under their older names, and they work too.) For the Project URL, click the **Connect** button at the top of the project page; the URL looks like `https://abcdefgh.supabase.co`. Save it as `NEXT_PUBLIC_SUPABASE_URL`.
4. **Tell Supabase where your site lives.** Open **Authentication**, then **URL Configuration**.
   - **Site URL:** your domain, like `https://lotwise.io`. (If you do not have the domain yet, use the `vercel.app` address from step 5 for now and come back.)
   - **Redirect URLs:** add `https://lotwise.io/auth/callback`. While testing, also add your `https://YOUR-PROJECT.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
5. **Set up email (required).** Supabase's built-in email only sends a couple of messages an hour and only to members of your Supabase team, so real visitors would never get their sign-in link. Use an email provider instead. With Resend as the example:
   - Sign up at **resend.com**, add your domain, and add the DNS records it shows you at your domain registrar. Wait until Resend shows the domain as verified.
   - Create an API key in Resend.
   - In Supabase open **Authentication**, then **Emails** (SMTP Settings), turn on **custom SMTP**, and enter: host `smtp.resend.com`, port `465`, username `resend`, password your Resend API key, sender email something like `hello@lotwise.io`, sender name `Lotwise`. Save.
   - Turn off link tracking in your email provider if it has it; tracking rewrites links and breaks sign-in.
   - Optional: in **Emails**, edit the Magic Link template so the subject reads "Your Lotwise sign-in link".
6. **Google sign-in.**
   - In Supabase, open **Authentication**, then **Sign In / Providers**, then **Google**. Copy the **Callback URL** it shows (it looks like `https://abcdefgh.supabase.co/auth/v1/callback`). Leave this tab open.
   - Go to **console.cloud.google.com**, create a project called Lotwise, and open **APIs & Services**, then **OAuth consent screen**. Choose **External**, enter the app name Lotwise, your support email, and your domain under authorized domains. Save.
   - Open **Credentials**, then **Create credentials**, then **OAuth client ID**. Choose **Web application**. Under **Authorized JavaScript origins** add `https://lotwise.io`. Under **Authorized redirect URIs** paste the Supabase callback URL. Click **Create** and copy the **Client ID** and **Client secret**.
   - Back in Supabase, turn Google on, paste the Client ID and Client secret, and save.
   - When you are ready to launch, return to the OAuth consent screen and click **Publish app**. Until you do, only test users you list there can use Google sign-in.

## Step 3. Stripe (payments)

1. Go to **stripe.com** and create an account. Leave **Test mode** on for now (the toggle is at the top of the dashboard). Nothing is charged in test mode.
2. Open **Developers**, then **API keys**, reveal the **Secret key** (it starts with `sk_test_`), and save it as `STRIPE_SECRET_KEY`.
3. Turn on the customer portal, which is where subscribers update cards and cancel: open **Settings**, then **Billing**, then **Customer portal**, allow customers to cancel subscriptions, update payment methods, and see invoices, and save.
4. You do not need to create products. Lotwise sends Stripe the three prices ($12 a month, $5 a month, $15 one time) when someone checks out. If you would rather manage products in Stripe, create them and put the price IDs in the three optional `STRIPE_PRICE_...` variables.

The webhook comes in step 6, once the site has an address.

## Step 4. Anthropic (optional AI reader)

Skip this and Paste Your Problem uses the free built-in reader.

1. Go to **console.anthropic.com**, create an account, and add a payment method.
2. Open **API keys**, create a key named `lotwise`, and save it as `ANTHROPIC_API_KEY`.
3. Set a monthly spending limit in the console so costs can never surprise you. $20 covers well over a thousand pasted problems.

The reader only answers signed-in Learner Pro subscribers, so nobody else can run up your bill.

## Step 5. Vercel (hosting)

1. Go to **vercel.com** and sign up with GitHub. Choose the **Pro** plan before you take payments.
2. Click **Add New**, then **Project**, and import `oliverdaigle/sco-site`. Vercel detects Next.js; leave the build settings as they are.
3. Open **Environment Variables** on the same screen and add every key from your notes, using the exact names from the table above. Set `ADMIN_EMAILS` to the email you will sign in with.
4. Click **Deploy** and wait three to five minutes. Open the `vercel.app` address it gives you. The "Demo mode" banner should be gone; that means Supabase is connected.
5. **Add your domain.** Buy it at any registrar. In Vercel open your project's **Settings**, then **Domains**, add `lotwise.io`, and follow the DNS instructions Vercel shows (usually one record at your registrar). HTTPS is set up automatically once DNS updates, which can take up to a few hours.
6. Set `NEXT_PUBLIC_SITE_URL` to `https://lotwise.io`, then redeploy: open **Deployments**, click the three dots on the latest one, and choose **Redeploy**.

Important: any time you change an environment variable in Vercel, redeploy. The site reads its settings when it is built.

## Step 6. Stripe webhook (how Stripe tells Lotwise someone paid)

1. In Stripe (still in test mode) open **Developers**, then **Webhooks** (Stripe may call this **Event destinations**), and add an endpoint.
2. Endpoint URL: `https://lotwise.io/api/stripe/webhook`
3. Select these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`.
4. Save, then reveal the **Signing secret** (it starts with `whsec_`). Add it in Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy.

## Step 7. Test everything in test mode

Work through this list on the real site. Each line should work before you take real money.

- [ ] The "Demo mode" banner is gone.
- [ ] **Email sign-in:** Sign in, enter your email, and the link arrives within a minute. Clicking it lands you on your Account page.
- [ ] **Google sign-in** works and lands on your Account page.
- [ ] **Business Pro checkout:** On Pricing, click Get Business Pro. Stripe's checkout opens. Pay with card `4242 4242 4242 4242`, any future date, any CVC, and any ZIP. You return to a "Business Pro is on" page, and Account shows Business Pro as Active.
- [ ] In Stripe, the webhook endpoint shows successful deliveries (green, status 200).
- [ ] What-if sliders, PDF summaries, and the full Plan Builder are unlocked.
- [ ] **Manage billing** on the Account page opens Stripe's portal. Cancel the subscription there; Pro stays until the end of the period.
- [ ] **Semester pass:** buy it with the test card. Account shows Learner Pro with an end date about five months out.
- [ ] **Paste Your Problem** reads a pasted homework problem. With the Anthropic key set, the line under the button reads "Read by Claude, with a built-in reader as backup."
- [ ] **Owner dashboard:** visit `/admin` while signed in with the email in `ADMIN_EMAILS`. It shows live numbers.
- [ ] **Share links:** paste a calculator's share link into iMessage or Slack. The preview image shows the answer.
- [ ] **Embeds:** copy a snippet from the embed builder into any test page and it renders.

## Step 8. Switch Stripe to live payments

1. In Stripe, click **Activate account** and fill in your business and bank details.
2. Turn **Test mode** off. Repeat step 3 (copy the **live** secret key, starting `sk_live_`, and set up the customer portal again, since live and test are separate) and step 6 (create the webhook again in live mode and copy its new signing secret).
3. In Vercel, replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live values and redeploy.
4. Make one real purchase with your own card (the $5 Learner monthly plan is cheapest), confirm Pro unlocks, then refund it and cancel the subscription in the Stripe dashboard.

## Step 9. Before you announce

- **Legal pages:** Terms, Privacy, and Disclaimer are plain-language templates with placeholders in square brackets, like `[CONTACT EMAIL]`. Fill them in and have a lawyer review them. They live in `src/screens/StaticScreens.tsx`. To edit on GitHub: open the file, click the pencil icon, change the text, and click **Commit changes**. Vercel redeploys on its own.
- **Social proof:** the landing page shows three marked placeholders. Replace them with real quotes (with permission) in `src/data/socialProof.ts`, and change `placeholder: true` to `placeholder: false` on each one you fill.
- **Google sign-in:** publish the OAuth consent screen (step 2.6).
- **Supabase:** upgrade to Pro so the project never pauses.
- **Launch kit:** posts, the video, and screenshots are in the `launch-kit` folder.

## When something goes wrong

| What you see | What to check |
|---|---|
| The "Demo mode" banner is still there | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing or misspelled in Vercel, or you did not redeploy after adding them. |
| The sign-in email never arrives | Custom SMTP is not set up, or the domain is not verified at your email provider. Supabase's **Authentication** logs show the error. |
| After clicking the sign-in link, you land on the sign-in page with "link expired" | The link was already used or is over an hour old, or the exact callback URL is missing from Supabase's Redirect URLs. |
| Google shows "redirect_uri_mismatch" | The redirect URI in Google's console must be the Supabase callback URL, exactly. |
| Someone paid but Pro did not unlock | In Stripe, open the webhook and look at recent deliveries. A red failure usually means `STRIPE_WEBHOOK_SECRET` belongs to a different endpoint (test versus live) or `SUPABASE_SERVICE_ROLE_KEY` is missing. Fix it, redeploy, then click **Resend** on the failed event. |
| Checkout says "Payments are not switched on yet" | `STRIPE_SECRET_KEY` is missing, or the site was not redeployed. |
| `/admin` says the account is not an admin | `ADMIN_EMAILS` must match your sign-in email exactly. Redeploy after changing it. |
| Paste Your Problem never uses the AI reader | `ANTHROPIC_API_KEY` is missing, or you are not signed in as a Learner Pro subscriber. |

## For a developer, later

- `npm install`, then `npm run dev` to run locally (demo mode with no `.env.local`).
- `npm test` runs the unit and engine tests; `npm run test:e2e` runs the browser tests (start a production build first with `npm run build && npm start`).
- `npm run verify` reruns the full math verification and regenerates the Verified page and `VERIFICATION-REPORT.md`. Run it after any change to a calculator.
- `npm run lighthouse` and `npm run a11y` audit performance and accessibility against a running production build.
- `DECISIONS.md` explains why everything is the way it is. `README.md` maps the code.
