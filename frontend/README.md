This is the Rentify frontend built with [Next.js](https://nextjs.org) and `tailwindcss`.

## Getting Started

Create a local env file first:

```bash
cp .env.example .env.local
```

Frontend env values:

- `NEXT_PUBLIC_API_BASE_URL` points to the backend API origin
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` enables the Cloudflare Turnstile widget on auth pages
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` enables Google OAuth on auth pages
- `NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID` enables Microsoft OAuth on auth pages
- `NEXT_PUBLIC_MICROSOFT_OAUTH_TENANT` controls the Microsoft authority path, for example `common`, `consumers`, `organizations`, or a specific tenant ID

OAuth redirect routes used by the frontend popup flow:

- `/auth/google`
- `/auth/microsoft`

The frontend now uses authorization code + PKCE for Google and Microsoft. The backend must be configured with matching provider client IDs, the frontend origin used for redirect URIs, and any provider client secrets required by your app registration.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open the frontend origin in your browser to see the auth flow.

Current auth routes:

- `/login`
- `/signup`
- `/verify-email`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
