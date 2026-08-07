# Deploying the Firestore security rules

## Why this is urgent

The ruleset live in production is:

```
allow read, write: if true;
```

The entire database — every squadron's cadet records included — is readable
**and writable by anyone on the internet, with no login**. The Firebase web
config in the site's source is a public identifier by design, so anyone can
construct a Firestore client against the project and do anything they like.

[firestore.rules](../firestore.rules) replaces this with per-squadron
isolation, verified by 38 emulator tests (`npm run test:rules`). Against the
old ruleset 24 of those tests fail; against the new one all 38 pass.

Deploying takes minutes, but three manual steps must happen **first** or
logins will break. Do them in this order.

## 1. Re-authenticate the CLI

The stored credential currently gets 401s from Google APIs:

```bash
firebase login --reauth
```

## 2. Create your SystemAdmins document (console)

The rules recognise system admins via a document at `SystemAdmins/{uid}`.
This collection is **rules-only**: app code never reads it, and the rules
forbid clients writing it, so it is managed in the console.

1. Firebase console → **Authentication** → find your account → copy its
   **User UID**.
2. Firestore → **Start collection** → ID: `SystemAdmins`.
3. Document ID: *paste your UID*. Add any field (e.g. `note: "owner"`) —
   only the document's existence matters.

Without this, your own system-admin login loses access to the System Admin
dashboard the moment rules deploy.

## 3. Migrate legacy document keys (console)

The rules check membership at `AuthorisedUsers/{uid}`. Two kinds of legacy
documents predate that convention:

**a) `AuthorisedUsers` docs keyed by request-id.** Squadron *creators* are
already keyed by uid; users granted access through the Admin Dashboard before
this fix are keyed by the request's id instead. For each squadron under
`SquadronDatabases/{sqn}/AuthorisedUsers`, any document whose ID does not
look like an Auth UID needs re-keying:

1. Note its `email` and fields.
2. Authentication → find the user by that email → copy their UID.
3. Create a new document in the same collection with the UID as its ID and
   the same fields; delete the old one.

**b) `MassUserList` docs with auto-generated ids.** These still *work* for
login (the app queries by the `UID` field), but revoking access only deletes
the uid-keyed doc, so legacy rows would survive a revoke. For each document:
copy its fields, create a new doc whose ID is the `UID` value, delete the
old. Low urgency — correctness of revoke, not of login.

## 4. Deploy

```bash
cd squadron-tracker
firebase deploy --only firestore:rules
```

## 5. Verify

- Sign in to the app as a normal squadron member — everything should work
  exactly as before.
- Firestore console → Rules → **Rules playground**: simulate a `get` of
  `/SquadronDatabases/1151/Cadets/anything` with **Authenticated = off** →
  must be **denied**.
- If a member reports "missing or insufficient permissions", their
  `AuthorisedUsers` doc is still keyed by request-id — see step 3a.

## Notes

- `npm run test:rules` runs the 38 rules tests locally. On this development
  machine it uses a portable JDK 11 in `tools/` (git-ignored) because newer
  JDKs' AF_UNIX-based pipes are blocked here; see
  [scripts/test-rules.js](../scripts/test-rules.js) for the details and the
  re-download command. CI runs the same tests on Linux with no workaround.
- Rules changes deploy independently of hosting: `--only firestore:rules`
  touches nothing else.
