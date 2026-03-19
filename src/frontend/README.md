# The Hat frontend

## Local development
- Install dependencies with `npm install`.
- Start the Vite dev server with `npm run dev`.
- Set `VITE_API_BASE_URL` so the client can reach the backend API.

## Internationalization
The frontend uses `i18next` with `react-i18next`.

### Current locales
- `en` — default
- `pl` — example non-default locale
- `ru` — additional non-default locale

### How language selection works
- The app reads the preferred language from local storage first.
- If no stored preference exists, it falls back to the browser language.
- Users can switch language from the in-app language switcher.
- The selected language is persisted under the `the-hat:language` local-storage key.

### Adding another locale
1. Add a new translation resource under [src/locales](src/locales).
2. Register the locale in [src/i18n.ts](src/i18n.ts).
3. No component changes are required if the same translation keys are provided.

## Backend message localization
Server-originated validation and gameplay messages can include stable message keys plus parameters.
The frontend translates those keys through the same i18n resources and falls back to the server-provided English text when a key is missing.
