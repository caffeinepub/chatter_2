# TalkZy

## Current State
The old backend is a basic messaging system with Internet Identity login and simple user profiles. It does not have username/password auth, gender-based matching, stranger chat, recharge, or disconnect approval. The frontend had repeated build failures.

## Requested Changes (Diff)

### Add
- Username/password based registration and login (no Internet Identity)
- User profile fields: username, password (hashed), gender, age, city, occupation
- Account balance/recharge system: recharge with 100 units, pay button
- Stranger chat matching: male connects only to female, female connects only to male
- Two match options from home: "Chat with Female" and "Chat with Male" (gender-specific)
- Active user tracking: users register heartbeat to appear online
- Match queue: users enter a waiting queue by desired gender, backend pairs them
- Chat session: text messages, image sharing, emoji/sticker, voice messages
- Disconnect with approval: one user requests disconnect, other must approve
- Logout
- 59-second matching timeout

### Modify
- Remove old Internet Identity login flow entirely
- Remove height field from registration

### Remove
- Friends/contacts system
- Block system
- Conversation history (chats are ephemeral stranger sessions)

## Implementation Plan

### Backend (Motoko)
1. User store: Map<Text, UserRecord> keyed by username
   - UserRecord: { passwordHash: Text, gender: Text, age: Nat, city: Text, occupation: Text, balance: Nat, principalId: Principal }
2. Session store: Map<Principal, SessionInfo> for login sessions
3. Online presence: Map<Principal, Time> heartbeat timestamps
4. Match queue: separate queues for users seeking male vs female
5. Active chats: Map<Text, ChatSession> where chatId = sorted pair of usernames
   - ChatSession: { user1: Principal, user2: Principal, messages: [ChatMessage], disconnectRequestedBy: ?Principal }
6. Functions:
   - register(username, password, gender, age, city, occupation) -> Result
   - login(username, password) -> Result with sessionToken
   - getMyProfile() -> UserProfile
   - rechargeAccount() -> new balance (adds 100)
   - heartbeat() -> () -- call every 10s to stay online
   - findMatch(desiredGender: Text) -> MatchResult (queues user, returns chatId if matched)
   - getActiveChatMessages(chatId) -> [ChatMessage]
   - sendChatMessage(chatId, content: MessageContent) -> Result
   - requestDisconnect(chatId) -> Result
   - approveDisconnect(chatId) -> Result
   - getChatSession(chatId) -> ?ChatSession
   - pollForMatch(desiredGender) -> ?Text (returns chatId when matched)

### Frontend
1. AuthScreen: Login form (username + password) + Register form (username, password, gender, age, city, occupation)
2. HomeScreen: Welcome, balance, "Chat with Female" button, "Chat with Male" button, Recharge button, Logout
3. RechargeScreen: Show balance, "Recharge 100" button, "Pay Now" -> PaymentScreen
4. PaymentScreen: Mock payment gateway with amount and pay button
5. FindingScreen: Spinner, "Finding match..." text, 59-second countdown timeout
6. ChatScreen: Message bubbles, image upload, emoji/sticker picker, voice record button, disconnect button
7. DisconnectModal: "User wants to disconnect. Approve?" with approve/deny buttons
