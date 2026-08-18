# Production deployment handoff

## Provisioned

- Firebase project: `lets-go-somewhere-3549f`
- Firebase web app: `lets-go-somewhere-web`
- Firestore Native database: `us-east4`
- Firestore rules: browser access is denied; the API is the only data boundary.

## Required before release

1. In Firebase Console → Authentication → Sign-in method, enable Google.
2. Supply the approved mapping as the Cloud Run environment variable `ROSTER_EMAILS`. Example:

```json
{"dan":"dan@example.com","james":"james@example.com","john":"john@example.com","matt":"matt@example.com","peter":"peter@example.com"}
```

3. Deploy the API to Cloud Run with its runtime service account and `ROSTER_EMAILS`; deploy the compiled `frontend/dist` to Firebase Hosting after its API base URL and Firebase web configuration have been set.

Never commit identity mappings, Firebase Admin credentials, or deployment secrets.
