import { Principal } from "@icp-sdk/core/principal";
import { useCallback } from "react";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// ── Types ────────────────────────────────────────────────────────────────────

export type Gender = "male" | "female";

export interface ParsedProfile {
  displayName: string;
  gender: Gender;
  age: number;
  city: string;
  occupation: string;
  principalText: string;
  seekingGender?: string;
  seekingTimestamp?: number;
  matchedWith?: string;
  matchedPrincipal?: string;
  matchedChatId?: string;
}

// ── Encode/decode profile ─────────────────────────────────────────────────────

/**
 * Format: "displayName||gender||age||city||occupation||principalText[||SEEKING:desiredGender:principal:ts][||MATCHED:displayName:chatId:principal]"
 */
export function encodeProfile(
  displayName: string,
  gender: Gender,
  age: number,
  city: string,
  occupation: string,
  principalText: string,
  extra?: string,
): string {
  const base = `${displayName}||${gender}||${age}||${city}||${occupation}||${principalText}`;
  return extra ? `${base}||${extra}` : base;
}

export function parseProfile(username: string): ParsedProfile | null {
  const parts = username.split("||");
  if (parts.length < 6) return null;
  const [
    displayName,
    gender,
    ageStr,
    city,
    occupation,
    principalText,
    ...rest
  ] = parts;
  const age = Number.parseInt(ageStr, 10);
  if (
    !displayName ||
    !gender ||
    Number.isNaN(age) ||
    !city ||
    !occupation ||
    !principalText
  ) {
    return null;
  }

  const result: ParsedProfile = {
    displayName,
    gender: gender as Gender,
    age,
    city,
    occupation,
    principalText,
  };

  // Parse optional flags
  for (const flag of rest) {
    if (flag.startsWith("SEEKING:")) {
      // SEEKING:desiredGender:myPrincipal:timestamp
      const [, desiredGender, , tsStr] = flag.split(":");
      result.seekingGender = desiredGender;
      result.seekingTimestamp = Number.parseInt(tsStr, 10);
    } else if (flag.startsWith("MATCHED:")) {
      // MATCHED:displayName:chatId:theirPrincipal
      const [, matchedWith, matchedChatId, matchedPrincipal] = flag.split(":");
      result.matchedWith = matchedWith;
      result.matchedChatId = matchedChatId;
      result.matchedPrincipal = matchedPrincipal;
    }
  }

  return result;
}

// ── Password helpers (localStorage per username) ──────────────────────────────

function getPasswordKey(username: string): string {
  return `talkzy_pwd_${username.toLowerCase()}`;
}

export function storePassword(username: string, password: string): void {
  localStorage.setItem(
    getPasswordKey(username),
    btoa(`${username}:${password}`),
  );
}

export function verifyPassword(username: string, password: string): boolean {
  const stored = localStorage.getItem(getPasswordKey(username));
  if (!stored) return false;
  return stored === btoa(`${username}:${password}`);
}

export function hasStoredPassword(username: string): boolean {
  return !!localStorage.getItem(getPasswordKey(username));
}

// ── Balance helpers ───────────────────────────────────────────────────────────

function getBalanceKey(username: string): string {
  return `talkzy_balance_${username.toLowerCase()}`;
}

export function getStoredBalance(username: string): number {
  const raw = localStorage.getItem(getBalanceKey(username));
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
}

export function addStoredBalance(username: string, amount: number): void {
  const current = getStoredBalance(username);
  localStorage.setItem(getBalanceKey(username), String(current + amount));
}

// ── Session helpers ───────────────────────────────────────────────────────────

const SESSION_KEY = "talkzy_session";

export function getStoredSession(): {
  username: string;
  principalText: string;
} | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeSession(username: string, principalText: string): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ username, principalText }),
  );
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── STALE threshold ───────────────────────────────────────────────────────────

const STALE_MS = 120_000; // 2 min

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatterStore() {
  const { actor } = useActor();
  const { identity, clear: clearIdentity } = useInternetIdentity();

  // ── Registration ─────────────────────────────────────────────────────────────

  const setupProfile = useCallback(
    async (
      displayName: string,
      gender: Gender,
      age: number,
      city: string,
      occupation: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!actor)
        return { ok: false, error: "Not connected to network. Please wait." };
      if (!identity) return { ok: false, error: "Not authenticated." };

      const principalText = identity.getPrincipal().toText();

      // Validate
      const lowerName = displayName.toLowerCase().trim();
      if (lowerName.length < 3 || lowerName.length > 20) {
        return { ok: false, error: "Username must be 3-20 characters." };
      }
      if (!/^[a-z0-9_]+$/.test(lowerName)) {
        return {
          ok: false,
          error: "Username: letters, numbers, underscores only.",
        };
      }
      if (password.length < 4) {
        return { ok: false, error: "Password must be at least 4 characters." };
      }
      if (age < 18 || age > 99) {
        return { ok: false, error: "Age must be between 18 and 99." };
      }
      if (!city.trim()) return { ok: false, error: "City is required." };
      if (!occupation.trim())
        return { ok: false, error: "Occupation is required." };

      const encodedUsername = encodeProfile(
        lowerName,
        gender,
        age,
        city.trim(),
        occupation.trim(),
        principalText,
      );

      try {
        // Register on-chain (will throw if username taken)
        await actor.registerUser(encodedUsername);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("taken")
        ) {
          return {
            ok: false,
            error: "Username already taken. Choose another.",
          };
        }
        return { ok: false, error: `Registration failed: ${msg}` };
      }

      // Store password and session
      storePassword(lowerName, password);
      storeSession(lowerName, principalText);

      return { ok: true };
    },
    [actor, identity],
  );

  // ── Login ─────────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (
      displayName: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!actor) return { ok: false, error: "Not connected. Please wait." };
      if (!identity) return { ok: false, error: "Not authenticated." };

      const lowerName = displayName.toLowerCase().trim();

      // Verify password stored locally
      if (!hasStoredPassword(lowerName)) {
        // Maybe they registered on another device — check backend
        // We'll do a best-effort lookup by checking getAllUsers
        try {
          const allUsers = await actor.getAllUsers();
          const match = allUsers.find((u) => {
            const p = parseProfile(u.username);
            return p?.displayName === lowerName;
          });
          if (!match) {
            return {
              ok: false,
              error: "User not found. Please create an account first.",
            };
          }
          // User exists on-chain. We can't verify password without local storage.
          // Allow them to re-link by checking if their current II principal matches
          const parsed = parseProfile(match.username);
          if (!parsed) return { ok: false, error: "Invalid profile data." };
          const currentPrincipal = identity.getPrincipal().toText();
          if (parsed.principalText !== currentPrincipal) {
            return {
              ok: false,
              error:
                "This account was registered from a different device. Please use your original device or create a new account.",
            };
          }
          // Same principal — store password locally and allow login
          storePassword(lowerName, password);
          storeSession(lowerName, currentPrincipal);
          return { ok: true };
        } catch {
          return { ok: false, error: "User not found." };
        }
      }

      if (!verifyPassword(lowerName, password)) {
        return { ok: false, error: "Incorrect password." };
      }

      // Also verify they still have a valid backend profile
      try {
        const profile = await actor.getCallerUserProfile();
        if (!profile) {
          return {
            ok: false,
            error: "Account not found on network. Please create a new account.",
          };
        }
        const parsed = parseProfile(profile.username);
        if (!parsed || parsed.displayName !== lowerName) {
          return {
            ok: false,
            error: "Account mismatch. Please create a new account.",
          };
        }
        const principalText = identity.getPrincipal().toText();
        storeSession(lowerName, principalText);
        return { ok: true };
      } catch {
        // If we can't reach backend, still allow login with local password
        const principalText = identity.getPrincipal().toText();
        storeSession(lowerName, principalText);
        return { ok: true };
      }
    },
    [actor, identity],
  );

  // ── Logout ────────────────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    // Clear seeking status in backend if present
    if (actor && identity) {
      try {
        const profile = await actor.getCallerUserProfile();
        if (profile) {
          const parsed = parseProfile(profile.username);
          if (parsed && (parsed.seekingGender || parsed.matchedWith)) {
            const clean = encodeProfile(
              parsed.displayName,
              parsed.gender,
              parsed.age,
              parsed.city,
              parsed.occupation,
              parsed.principalText,
            );
            await actor.saveCallerUserProfile({
              username: clean,
              createdAt: profile.createdAt,
            });
          }
        }
      } catch {
        // best effort
      }
    }
    clearSession();
    clearIdentity();
  }, [actor, identity, clearIdentity]);

  // ── Seeking / Matching ────────────────────────────────────────────────────────

  /**
   * Set current user as "seeking" in their backend profile
   */
  const setSeekingStatus = useCallback(
    async (desiredGender: Gender): Promise<void> => {
      if (!actor || !identity) return;
      try {
        const profile = await actor.getCallerUserProfile();
        if (!profile) return;
        const parsed = parseProfile(profile.username);
        if (!parsed) return;
        const principalText = identity.getPrincipal().toText();
        const seekFlag = `SEEKING:${desiredGender}:${principalText}:${Date.now()}`;
        const encoded = encodeProfile(
          parsed.displayName,
          parsed.gender,
          parsed.age,
          parsed.city,
          parsed.occupation,
          parsed.principalText,
          seekFlag,
        );
        await actor.saveCallerUserProfile({
          username: encoded,
          createdAt: profile.createdAt,
        });
      } catch {
        // best effort
      }
    },
    [actor, identity],
  );

  /**
   * Clear seeking/matched status
   */
  const clearSeekingStatus = useCallback(async (): Promise<void> => {
    if (!actor) return;
    try {
      const profile = await actor.getCallerUserProfile();
      if (!profile) return;
      const parsed = parseProfile(profile.username);
      if (!parsed) return;
      const clean = encodeProfile(
        parsed.displayName,
        parsed.gender,
        parsed.age,
        parsed.city,
        parsed.occupation,
        parsed.principalText,
      );
      await actor.saveCallerUserProfile({
        username: clean,
        createdAt: profile.createdAt,
      });
    } catch {
      // best effort
    }
  }, [actor]);

  /**
   * Find a user of the desired gender who is actively seeking
   */
  const findPotentialMatch = useCallback(
    async (
      desiredGender: Gender,
      myDisplayName: string,
    ): Promise<ParsedProfile | null> => {
      if (!actor) return null;
      try {
        const allUsers = await actor.getAllUsers();
        const now = Date.now();

        const candidates = allUsers
          .map((u) => parseProfile(u.username))
          .filter((p): p is ParsedProfile => {
            if (!p) return false;
            if (p.displayName === myDisplayName) return false; // not self
            if (p.gender !== desiredGender) return false;
            if (!p.seekingGender) return false;
            if (!p.seekingTimestamp) return false;
            if (now - p.seekingTimestamp > STALE_MS) return false; // stale
            if (p.matchedWith) return false; // already matched
            return true;
          });

        if (candidates.length === 0) return null;

        // Pick oldest (has been waiting longest)
        candidates.sort(
          (a, b) => (a.seekingTimestamp ?? 0) - (b.seekingTimestamp ?? 0),
        );
        return candidates[0];
      } catch {
        return null;
      }
    },
    [actor],
  );

  /**
   * Accept a match — update own profile to MATCHED state
   */
  const acceptMatch = useCallback(
    async (seeker: ParsedProfile): Promise<{ chatId: string; ok: boolean }> => {
      if (!actor || !identity) return { chatId: "", ok: false };
      try {
        const profile = await actor.getCallerUserProfile();
        if (!profile) return { chatId: "", ok: false };
        const parsed = parseProfile(profile.username);
        if (!parsed) return { chatId: "", ok: false };

        const myPrincipalText = identity.getPrincipal().toText();
        const chatId = [parsed.displayName, seeker.displayName]
          .sort()
          .join("_CHAT_");

        const matchFlag = `MATCHED:${seeker.displayName}:${chatId}:${seeker.principalText}`;
        const encoded = encodeProfile(
          parsed.displayName,
          parsed.gender,
          parsed.age,
          parsed.city,
          parsed.occupation,
          myPrincipalText,
          matchFlag,
        );
        await actor.saveCallerUserProfile({
          username: encoded,
          createdAt: profile.createdAt,
        });

        return { chatId, ok: true };
      } catch {
        return { chatId: "", ok: false };
      }
    },
    [actor, identity],
  );

  /**
   * Poll to see if someone accepted our match request
   */
  const pollForMatch = useCallback(
    async (
      myDisplayName: string,
    ): Promise<{ chatId: string; partner: ParsedProfile } | null> => {
      if (!actor) return null;
      try {
        const allUsers = await actor.getAllUsers();
        const now = Date.now();

        for (const u of allUsers) {
          const p = parseProfile(u.username);
          if (!p) continue;
          if (p.matchedWith !== myDisplayName) continue;
          if (!p.matchedChatId) continue;
          if (!p.seekingTimestamp && p.matchedChatId) {
            // Check it's recent enough
            // matchedChatId doesn't have timestamp, rely on seeker's seeking timestamp
            return { chatId: p.matchedChatId, partner: p };
          }
          // Also accept if seeking timestamp is recent
          if (p.seekingTimestamp && now - p.seekingTimestamp < STALE_MS) {
            return { chatId: p.matchedChatId, partner: p };
          }
          // Just return it anyway — someone matched with us
          return { chatId: p.matchedChatId, partner: p };
        }
        return null;
      } catch {
        return null;
      }
    },
    [actor],
  );

  // ── Chat via backend messages ─────────────────────────────────────────────────

  /**
   * Import Principal from string
   */
  const principalFromText = useCallback((text: string): Principal | null => {
    try {
      return Principal.fromText(text);
    } catch {
      return null;
    }
  }, []);

  const sendChatMessage = useCallback(
    async (partnerPrincipalText: string, text: string): Promise<void> => {
      if (!actor) return;
      const p = principalFromText(partnerPrincipalText);
      if (!p) return;
      try {
        await actor.sendMessage(p, { __kind__: "text", text });
      } catch (e) {
        console.error("sendChatMessage error:", e);
        throw e;
      }
    },
    [actor, principalFromText],
  );

  const sendImageMessage = useCallback(
    async (partnerPrincipalText: string, dataUrl: string): Promise<void> => {
      if (!actor) return;
      const p = principalFromText(partnerPrincipalText);
      if (!p) return;
      try {
        await actor.sendMessage(p, {
          __kind__: "text",
          text: `__IMAGE__:${dataUrl}`,
        });
      } catch (e) {
        console.error("sendImageMessage error:", e);
        throw e;
      }
    },
    [actor, principalFromText],
  );

  const sendVoiceMessage = useCallback(
    async (partnerPrincipalText: string, base64Data: string): Promise<void> => {
      if (!actor) return;
      const p = principalFromText(partnerPrincipalText);
      if (!p) return;
      try {
        await actor.sendMessage(p, {
          __kind__: "text",
          text: `__VOICE__:${base64Data}`,
        });
      } catch (e) {
        console.error("sendVoiceMessage error:", e);
        throw e;
      }
    },
    [actor, principalFromText],
  );

  const sendSystemMessage = useCallback(
    async (partnerPrincipalText: string, systemCmd: string): Promise<void> => {
      if (!actor) return;
      const p = principalFromText(partnerPrincipalText);
      if (!p) return;
      try {
        await actor.sendMessage(p, {
          __kind__: "text",
          text: `__SYSTEM__:${systemCmd}`,
        });
      } catch (e) {
        console.error("sendSystemMessage error:", e);
        throw e;
      }
    },
    [actor, principalFromText],
  );

  const getChatMessages = useCallback(
    async (partnerPrincipalText: string) => {
      if (!actor) return [];
      const p = principalFromText(partnerPrincipalText);
      if (!p) return [];
      try {
        const conv = await actor.getConversation(p);
        return conv.messages;
      } catch {
        return [];
      }
    },
    [actor, principalFromText],
  );

  // ── Balance ───────────────────────────────────────────────────────────────────

  const addBalance = useCallback((username: string, amount: number): void => {
    addStoredBalance(username, amount);
  }, []);

  const getBalance = useCallback((username: string): number => {
    return getStoredBalance(username);
  }, []);

  return {
    actor,
    identity,
    setupProfile,
    login,
    logout,
    setSeekingStatus,
    clearSeekingStatus,
    findPotentialMatch,
    acceptMatch,
    pollForMatch,
    sendChatMessage,
    sendImageMessage,
    sendVoiceMessage,
    sendSystemMessage,
    getChatMessages,
    addBalance,
    getBalance,
    principalFromText,
    parseProfile,
    encodeProfile,
  };
}
