# TalkZy

## Current State
TalkZy is a stranger chat app with username/password auth, gender-based matching, text/image/emoji/voice messages, and a recharge flow. The backend uses the `authorization` component (role-based access control with Internet Identity principals). The frontend uses `useInternetIdentity` hook and auto-triggers an Internet Identity popup on page load. The `useActor` hook calls `_initializeAccessControlWithSecret` which requires the authorization component. Chat screens use `identity.getPrincipal()` to identify the current user.

## Requested Changes (Diff)

### Add
- Simple anonymous actor creation (no II, no identity dependency)
- Session-based "my principal" tracking using a fake/derived identifier stored in localStorage at login time
- Backend user identity tied to a session token rather than II principal

### Modify
- Backend: Remove `authorization` component entirely. Remove all `AccessControl` calls. Remove `MixinAuthorization`. Remove auth guards from all functions. Keep all user/chat/matching logic.
- `useActor.ts`: Remove `useInternetIdentity` dependency. Always create an anonymous actor. Remove `_initializeAccessControlWithSecret` call.
- `useChatterStore.ts`: Remove `useInternetIdentity` dependency. Remove `identity` usage. The "current principal" should be read from the stored session (the principalText stored at registration/login time — which will now be a generated anonymous principal from the canister).
- `AuthScreen.tsx`: Remove all II-related code. Remove the `useInternetIdentity` import. Remove the auto-trigger `useEffect` that calls `iiLogin()`. Remove the "Connect to Network" button. The form should just show immediately — no spinner waiting for II.
- `App.tsx`: Remove `useInternetIdentity`. Remove II-gating logic. On mount, just check localStorage session and backend profile.
- `ChatScreen.tsx`: Get `myPrincipalText` from stored session instead of `identity`.
- `HomeScreen.tsx`, `FindingScreen.tsx`: No II dependency changes needed (they already use session/actor).
- `caffeine.lock.json`: Remove `authorization` component.
- Backend: All functions become open (no permission checks). `registerUser`, `saveCallerUserProfile`, `getCallerUserProfile`, `getAllUsers`, `sendMessage`, `getConversation` all work without auth guards.

### Remove
- `useInternetIdentity` hook usage from all components
- `authorization` Caffeine component
- All `AccessControl` and `MixinAuthorization` imports from backend
- The auto-II-login effect in `AuthScreen`
- The `_initializeAccessControlWithSecret` call in `useActor`

## Implementation Plan
1. Rewrite `backend/main.mo` — remove authorization imports/mixin, remove all AccessControl guards, keep all data structures and functions
2. Remove `authorization` from `caffeine.lock.json`
3. Rewrite `useActor.ts` — always use anonymous actor, no II
4. Rewrite `useChatterStore.ts` — remove `useInternetIdentity`, get myPrincipal from stored session
5. Rewrite `AuthScreen.tsx` — remove II auto-trigger, show forms immediately
6. Rewrite `App.tsx` — remove II gating
7. Rewrite `ChatScreen.tsx` — get myPrincipalText from stored session
8. Regenerate backend and validate frontend build
