# Sign in with Google, Facebook and Apple

Each provider's button shows only when all of its values are set in `apps/web/.env.local` (locally) or the host's environment (live). Restart the site after changing them. The return address is always `SITE_URL` + `/api/auth/<provider>/callback`.

The values are secrets: they go in `.env.local` or the host's settings, never in the code.

## Google (free, works on localhost)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or pick one) for MTeam.
2. **APIs & Services → OAuth consent screen**: External, app name "MTeam", support email, the site's address. Scopes: only `openid`.
3. **Credentials → Create credentials → OAuth client ID**, type *Web application*.
   - Authorized redirect URI: `http://localhost:3111/api/auth/google/callback` (add the live one at launch).
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. While the consent screen is in *Testing*, only the test users listed there can sign in. Publish it before launch.

## Facebook (free, works on localhost)

1. On [Meta for Developers](https://developers.facebook.com/apps/), create an app of type *Consumer* (or "Authenticate and request data from users with Facebook Login").
2. Add the **Facebook Login** product. Under its settings, add the valid OAuth redirect URI `http://localhost:3111/api/auth/facebook/callback` (and the live one at launch).
3. **App settings → Basic**: copy the App ID and App Secret into `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.
4. Only `public_profile` is requested, which needs no review, and only the id is read from it. In development mode, only the app's admins, developers and testers can sign in; switch the app to *Live* at launch.

## Apple (paid, live site only)

Apple needs the Apple Developer Program (99 USD a year) and refuses `localhost` and plain `http` return addresses, so this is set up at launch.

1. **Certificates, Identifiers & Profiles → Identifiers**: an App ID with *Sign in with Apple* enabled.
2. A **Services ID** (this is `APPLE_CLIENT_ID`) with *Sign in with Apple* on, the site's domain, and the return URL `https://<site>/api/auth/apple/callback`.
3. **Keys**: a key with *Sign in with Apple*, linked to the App ID. Download the `.p8` file once; its Key ID is `APPLE_KEY_ID`.
4. `APPLE_TEAM_ID` is shown at the top right of the developer account.
5. `APPLE_PRIVATE_KEY` is the `.p8` file's text on one line, with each line break written as `\n`.

No name or email is asked of Apple: asking makes Apple post the answer back across sites, and the user's Apple id is all a sign-in needs.

## How accounts work

- The first sign-in with a provider makes a new account. It is never joined to an existing one by email.
- No name or email is taken from any provider, so nothing the provider knows about someone is shown to others here, in chat or elsewhere.
- Such an account has no phone. Posting a listing asks for one first and checks it with an SMS code, because the phone is the listing's contact. A phone that already has its own account cannot be added; that person signs in with the phone instead.
