# Chatter

## Current State
The app currently uses Internet Identity (II) for authentication and has a simple messaging system with username registration. It has a basic backend with user profiles, message sending, and conversation listing.

## Requested Changes (Diff)

### Add
- Custom username/password authentication (no Internet Identity)
- Registration form: unique username, password, gender (male/female), age, height, city, occupation
- Login form: username + password
- "Recharge Account" feature: fixed amount of 100 with a "Pay Now" button leading to a payment gateway page (UI only, no real payment processor)
- "New Chat" button: connects the logged-in user to another actively online user of the opposite gender (male connects to female, female connects to male)
- Active session tracking: mark users as online/offline
- Chat screen: text messages, image uploads, emoji/sticker picker, voice messages (audio recording)
- Disconnect flow: user can only disconnect with the other user's approval (both must agree to end)
- Logout option
- No friend/contact lists, no blocking

### Modify
- Replace II-based auth with custom username/password auth stored in backend
- Replace old UserProfile with extended profile including gender, age, height, city, occupation
- Update message sending to work within active paired sessions only

### Remove
- Internet Identity / authorization component usage
- Old simple username-only registration
- Conversation list / contacts view (users don't add friends)

## Implementation Plan
1. Backend: store users with hashed passwords, extended profile fields, active sessions, pairing logic, disconnect-approval flow
2. Backend: APIs for register, login, logout, set online status, find match (opposite gender), send message (text/image blob/audio blob), request disconnect, approve disconnect
3. Frontend: Auth screen with register/login tabs
4. Frontend: Home screen (post-login) with Recharge and New Chat buttons
5. Frontend: Recharge page with amount 100 and Pay Now button (mock payment gateway page)
6. Frontend: Matchmaking loading screen while finding a partner
7. Frontend: Chat screen with text input, image upload, emoji/sticker panel, voice message recorder, disconnect request flow
8. Frontend: Logout button
