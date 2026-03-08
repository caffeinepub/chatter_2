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
  passwordHash?: string;
  seekingGender?: string;
  seekingTimestamp?: number;
  matchedWith?: string;
  matchedPrincipal?: string;
  matchedChatId?: string;
  matchAcceptTimestamp?: number;
}

// ── Encode/decode profile ─────────────────────────────────────────────────────

/**
 * Format:
 * "displayName||gender||age||city||occupation||principalText||PWD:passwordHash[||SEEKING:desiredGender:principal:ts][||MATCHED:displayName:chatId:theirPrincipal:acceptTs]"
 *
 * The 7th base field is PWD:hash (always present after registration).
 */
export function encodeProfile(
  displayName: string,
  gender: Gender,
  age: number,
  city: string,
  occupation: string,
  principalText: string,
  passwordHash?: string,
  extra?: string,
): string {
  const base = `${displayName}||${gender}||${age}||${city}||${occupation}||${principalText}`;
  const withPwd = passwordHash ? `${base}||PWD:${passwordHash}` : base;
  return extra ? `${withPwd}||${extra}` : withPwd;
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
    if (flag.startsWith("PWD:")) {
      result.passwordHash = flag.slice(4);
    } else if (flag.startsWith("SEEKING:")) {
      // SEEKING:desiredGender:myPrincipal:timestamp
      const [, desiredGender, , tsStr] = flag.split(":");
      result.seekingGender = desiredGender;
      result.seekingTimestamp = Number.parseInt(tsStr, 10);
    } else if (flag.startsWith("MATCHED:")) {
      // MATCHED:displayName:chatId:theirPrincipal:acceptTimestamp
      const [, matchedWith, matchedChatId, matchedPrincipal, acceptTsStr] =
        flag.split(":");
      result.matchedWith = matchedWith;
      result.matchedChatId = matchedChatId;
      result.matchedPrincipal = matchedPrincipal;
      if (acceptTsStr) {
        result.matchAcceptTimestamp = Number.parseInt(acceptTsStr, 10);
      }
    }
  }

  return result;
}

// ── Password helpers ──────────────────────────────────────────────────────────

/**
 * Compute password hash — stored in both localStorage and backend profile.
 */
function computePasswordHash(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

function getPasswordKey(username: string): string {
  return `talkzy_pwd_${username.toLowerCase()}`;
}

export function storePassword(username: string, password: string): void {
  localStorage.setItem(
    getPasswordKey(username),
    computePasswordHash(username, password),
  );
}

export function verifyPassword(username: string, password: string): boolean {
  const stored = localStorage.getItem(getPasswordKey(username));
  if (!stored) return false;
  return stored === computePasswordHash(username, password);
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

const STALE_MS = 180_000; // 3 min — generous to avoid false "stale" drops
const MATCH_ACCEPT_STALE_MS = 30_000; // matched entries older than 30s should be ignored

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

      const principalText = identity?.getPrincipal().toText() ?? "anonymous";

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

      // Compute password hash to embed in the profile
      const passwordHash = computePasswordHash(lowerName, password);

      const encodedUsername = encodeProfile(
        lowerName,
        gender,
        age,
        city.trim(),
        occupation.trim(),
        principalText,
        passwordHash,
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

      // Store password locally and save session
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

      const lowerName = displayName.toLowerCase().trim();
      const currentPrincipal = identity?.getPrincipal().toText() ?? "anonymous";
      const expectedHash = computePasswordHash(lowerName, password);

      // ── Step 1: Try local password check first (fast path - same device) ──
      if (hasStoredPassword(lowerName)) {
        if (!verifyPassword(lowerName, password)) {
          return { ok: false, error: "Incorrect password." };
        }

        // Check if current principal matches the backend profile
        try {
          const profile = await actor.getCallerUserProfile();
          if (profile) {
            const parsed = parseProfile(profile.username);
            if (parsed && parsed.displayName === lowerName) {
              // Same device - straightforward login
              storeSession(lowerName, currentPrincipal);
              return { ok: true };
            }
          }
        } catch {
          // Backend unreachable - fall through to full login
        }
      }

      // ── Step 2: Cross-device login — find user by username in getAllUsers() ──
      let allUsers: Array<{ username: string }> = [];
      try {
        allUsers = await actor.getAllUsers();
      } catch {
        return { ok: false, error: "Could not reach network. Please retry." };
      }

      // Find the user's profile by display name
      const matchedUser = allUsers.find((u) => {
        const p = parseProfile(u.username);
        return p?.displayName === lowerName;
      });

      if (!matchedUser) {
        return {
          ok: false,
          error: "User not found. Please create an account first.",
        };
      }

      const parsedUser = parseProfile(matchedUser.username);
      if (!parsedUser) {
        return { ok: false, error: "Invalid profile data on network." };
      }

      // ── Step 3: Verify password against embedded hash in profile ──
      if (parsedUser.passwordHash) {
        // New-format profile with embedded hash
        if (parsedUser.passwordHash !== expectedHash) {
          return { ok: false, error: "Incorrect password." };
        }
      } else {
        // Legacy profile without embedded hash — we can't verify from another device
        // If local password exists we've already verified above; otherwise reject
        if (!hasStoredPassword(lowerName)) {
          return {
            ok: false,
            error:
              "This account was created before password sync was available. Please log in from your original device once to enable cross-device login.",
          };
        }
        // Local password verified above — allow the login
      }

      // ── Step 4: Principal mismatch (different device) — create new profile ──
      if (parsedUser.principalText !== currentPrincipal) {
        // Register a NEW backend profile for the current device's principal.
        // The backend maps caller's principal -> profile, so registerUser() from
        // this principal creates a fresh entry tied to the current II identity.
        const newEncodedUsername = encodeProfile(
          parsedUser.displayName,
          parsedUser.gender,
          parsedUser.age,
          parsedUser.city,
          parsedUser.occupation,
          currentPrincipal, // current device's principal
          expectedHash, // embed the password hash
        );

        try {
          await actor.registerUser(newEncodedUsername);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // "Already registered" means this principal already has a profile —
          // that's fine, it just means they logged in from this device before.
          if (
            !msg.toLowerCase().includes("already") &&
            !msg.toLowerCase().includes("registered")
          ) {
            return { ok: false, error: `Login failed: ${msg}` };
          }
          // If already registered, update the profile to have the latest data
          try {
            const existingProfile = await actor.getCallerUserProfile();
            if (existingProfile) {
              const existingParsed = parseProfile(existingProfile.username);
              // Only update if the profile doesn't already match this user
              if (!existingParsed || existingParsed.displayName !== lowerName) {
                await actor.saveCallerUserProfile({
                  username: newEncodedUsername,
                  createdAt: existingProfile.createdAt,
                });
              }
            }
          } catch {
            // best effort — login still succeeds
          }
        }
      } else {
        // Same principal — if profile doesn't have password hash yet, upgrade it
        if (!parsedUser.passwordHash) {
          try {
            const profile = await actor.getCallerUserProfile();
            if (profile) {
              const upgraded = encodeProfile(
                parsedUser.displayName,
                parsedUser.gender,
                parsedUser.age,
                parsedUser.city,
                parsedUser.occupation,
                currentPrincipal,
                expectedHash,
              );
              await actor.saveCallerUserProfile({
                username: upgraded,
                createdAt: profile.createdAt,
              });
            }
          } catch {
            // best effort
          }
        }
      }

      // Store password locally and save session
      storePassword(lowerName, password);
      storeSession(lowerName, currentPrincipal);
      return { ok: true };
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
              parsed.passwordHash,
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
          parsed.passwordHash,
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
        parsed.passwordHash,
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

        const acceptTs = Date.now();
        const matchFlag = `MATCHED:${seeker.displayName}:${chatId}:${seeker.principalText}:${acceptTs}`;
        const encoded = encodeProfile(
          parsed.displayName,
          parsed.gender,
          parsed.age,
          parsed.city,
          parsed.occupation,
          myPrincipalText,
          parsed.passwordHash,
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
   * Poll to see if someone accepted our match request.
   * Returns the chat ID and partner profile if found.
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
          // Someone has matched with us
          if (p.matchedWith !== myDisplayName) continue;
          if (!p.matchedChatId) continue;

          // Verify the match accept timestamp is fresh (not a stale leftover)
          if (p.matchAcceptTimestamp) {
            if (now - p.matchAcceptTimestamp > MATCH_ACCEPT_STALE_MS) {
              // This match was accepted long ago; might be stale — skip
              continue;
            }
          }

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
