import { useCallback, useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type Gender = "male" | "female";

export type UserData = {
  username: string;
  passwordHash: string; // btoa(username + ":" + password)
  gender: Gender;
  age: number;
  height: number; // cm
  city: string;
  occupation: string;
  balance: number;
};

export type OnlineUser = {
  username: string;
  gender: Gender;
  timestamp: number;
};

export type ChatMessage = {
  id: string;
  senderUsername: string;
  type: "text" | "image" | "audio" | "emoji" | "sticker";
  content: string;
  timestamp: number;
};

export type ChatSession = {
  userA: string;
  userB: string;
  messages: ChatMessage[];
  disconnectRequests: string[];
};

// ── Storage keys ─────────────────────────────────────────────────────────────

const KEY_USERS = "chatter_users";
const KEY_SESSION = "chatter_session";
const KEY_ONLINE = "chatter_online";
const KEY_CHATS = "chatter_chats";

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function hashPassword(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

function chatKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatterStore() {
  const [currentUsername, setCurrentUsername] = useState<string | null>(() =>
    localStorage.getItem(KEY_SESSION),
  );

  // Re-read users from storage to get fresh data
  const getUsers = useCallback(
    (): Record<string, UserData> => readJSON(KEY_USERS, {}),
    [],
  );

  const currentUser: UserData | null = currentUsername
    ? (getUsers()[currentUsername] ?? null)
    : null;

  // ── Auth ────────────────────────────────────────────────────────────────────

  const register = useCallback(
    (
      data: Omit<UserData, "passwordHash" | "balance"> & { password: string },
    ): { ok: boolean; error?: string } => {
      const users = getUsers();
      const lowerUsername = data.username.toLowerCase();

      if (lowerUsername.length < 3 || lowerUsername.length > 20) {
        return { ok: false, error: "Username must be 3-20 characters." };
      }
      if (!/^[a-z0-9_]+$/.test(lowerUsername)) {
        return {
          ok: false,
          error: "Username can only contain letters, numbers and underscores.",
        };
      }
      if (users[lowerUsername]) {
        return { ok: false, error: "Username already taken." };
      }
      if (data.password.length < 4) {
        return { ok: false, error: "Password must be at least 4 characters." };
      }
      if (data.age < 18 || data.age > 99) {
        return { ok: false, error: "Age must be between 18 and 99." };
      }
      if (data.height < 140 || data.height > 220) {
        return { ok: false, error: "Height must be between 140 and 220 cm." };
      }
      if (!data.city.trim()) {
        return { ok: false, error: "City is required." };
      }
      if (!data.occupation.trim()) {
        return { ok: false, error: "Occupation is required." };
      }

      const newUser: UserData = {
        username: lowerUsername,
        passwordHash: hashPassword(lowerUsername, data.password),
        gender: data.gender,
        age: data.age,
        height: data.height,
        city: data.city.trim(),
        occupation: data.occupation.trim(),
        balance: 0,
      };

      users[lowerUsername] = newUser;
      writeJSON(KEY_USERS, users);
      localStorage.setItem(KEY_SESSION, lowerUsername);
      setCurrentUsername(lowerUsername);
      return { ok: true };
    },
    [getUsers],
  );

  const login = useCallback(
    (username: string, password: string): { ok: boolean; error?: string } => {
      const users = getUsers();
      const lowerUsername = username.toLowerCase().trim();
      const user = users[lowerUsername];
      if (!user) {
        return { ok: false, error: "Username not found." };
      }
      if (user.passwordHash !== hashPassword(lowerUsername, password)) {
        return { ok: false, error: "Incorrect password." };
      }
      localStorage.setItem(KEY_SESSION, lowerUsername);
      setCurrentUsername(lowerUsername);
      return { ok: true };
    },
    [getUsers],
  );

  const logout = useCallback(() => {
    if (currentUsername) {
      setOfflineUser(currentUsername);
    }
    localStorage.removeItem(KEY_SESSION);
    setCurrentUsername(null);
  }, [currentUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Balance ─────────────────────────────────────────────────────────────────

  const addBalance = useCallback(
    (amount: number): void => {
      if (!currentUsername) return;
      const users = getUsers();
      if (users[currentUsername]) {
        users[currentUsername].balance += amount;
        writeJSON(KEY_USERS, users);
      }
    },
    [currentUsername, getUsers],
  );

  const getBalance = useCallback((): number => {
    if (!currentUsername) return 0;
    return getUsers()[currentUsername]?.balance ?? 0;
  }, [currentUsername, getUsers]);

  // ── Online presence ──────────────────────────────────────────────────────────

  function setOnlineUser(username: string, gender: Gender): void {
    const online = readJSON<OnlineUser[]>(KEY_ONLINE, []);
    const filtered = online.filter((u) => u.username !== username);
    filtered.push({ username, gender, timestamp: Date.now() });
    writeJSON(KEY_ONLINE, filtered);
  }

  function setOfflineUser(username: string): void {
    const online = readJSON<OnlineUser[]>(KEY_ONLINE, []);
    writeJSON(
      KEY_ONLINE,
      online.filter((u) => u.username !== username),
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: setOnlineUser and setOfflineUser are stable plain functions
  const setOnline = useCallback(() => {
    if (!currentUser) return;
    setOnlineUser(currentUser.username, currentUser.gender);
  }, [currentUser]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setOfflineUser is a stable plain function
  const setOffline = useCallback(() => {
    if (!currentUsername) return;
    setOfflineUser(currentUsername);
  }, [currentUsername]);

  // ── Matchmaking ──────────────────────────────────────────────────────────────

  const getOnlineUsers = useCallback((): OnlineUser[] => {
    // Clean stale (> 15s) entries
    const online = readJSON<OnlineUser[]>(KEY_ONLINE, []);
    const fresh = online.filter((u) => Date.now() - u.timestamp < 15_000);
    if (fresh.length !== online.length) {
      writeJSON(KEY_ONLINE, fresh);
    }
    return fresh;
  }, []);

  const getActiveChatUsernames = useCallback((): Set<string> => {
    const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
    const active = new Set<string>();
    for (const session of Object.values(chats)) {
      // A session is active if it has no disconnect requests from BOTH users
      if (session.disconnectRequests.length < 2) {
        active.add(session.userA);
        active.add(session.userB);
      }
    }
    return active;
  }, []);

  /**
   * Try to find a match. Returns partner username if found, null otherwise.
   * Male finds female, female finds male.
   */
  const findMatch = useCallback((): string | null => {
    if (!currentUser) return null;
    const targetGender: Gender =
      currentUser.gender === "male" ? "female" : "male";
    const online = getOnlineUsers();
    const inChat = getActiveChatUsernames();

    const candidates = online.filter(
      (u) =>
        u.username !== currentUser.username &&
        u.gender === targetGender &&
        !inChat.has(u.username) &&
        !inChat.has(currentUser.username),
    );

    if (candidates.length === 0) return null;

    // Pick the one waiting longest
    candidates.sort((a, b) => a.timestamp - b.timestamp);
    const partner = candidates[0];

    // Create chat session
    const key = chatKey(currentUser.username, partner.username);
    const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
    if (!chats[key]) {
      chats[key] = {
        userA: currentUser.username,
        userB: partner.username,
        messages: [],
        disconnectRequests: [],
      };
      writeJSON(KEY_CHATS, chats);
    }

    return partner.username;
  }, [currentUser, getOnlineUsers, getActiveChatUsernames]);

  /**
   * Check if current user already has an active chat. Returns partner or null.
   */
  const getActiveChat = useCallback((): {
    partner: string;
    key: string;
  } | null => {
    if (!currentUsername) return null;
    const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
    for (const [key, session] of Object.entries(chats)) {
      if (
        (session.userA === currentUsername ||
          session.userB === currentUsername) &&
        session.disconnectRequests.length < 2
      ) {
        const partner =
          session.userA === currentUsername ? session.userB : session.userA;
        return { partner, key };
      }
    }
    return null;
  }, [currentUsername]);

  // ── Messaging ─────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (chatKeyStr: string, msg: Omit<ChatMessage, "id" | "timestamp">): void => {
      const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
      if (!chats[chatKeyStr]) return;
      const newMsg: ChatMessage = {
        ...msg,
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
      };
      chats[chatKeyStr].messages.push(newMsg);
      writeJSON(KEY_CHATS, chats);
    },
    [],
  );

  const getMessages = useCallback((chatKeyStr: string): ChatMessage[] => {
    const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
    return chats[chatKeyStr]?.messages ?? [];
  }, []);

  const getChatSession = useCallback(
    (chatKeyStr: string): ChatSession | null => {
      const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
      return chats[chatKeyStr] ?? null;
    },
    [],
  );

  // ── Disconnect flow ───────────────────────────────────────────────────────────

  const requestDisconnect = useCallback(
    (chatKeyStr: string): void => {
      if (!currentUsername) return;
      const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
      if (!chats[chatKeyStr]) return;
      if (!chats[chatKeyStr].disconnectRequests.includes(currentUsername)) {
        chats[chatKeyStr].disconnectRequests.push(currentUsername);
        writeJSON(KEY_CHATS, chats);
      }
    },
    [currentUsername],
  );

  const approveDisconnect = useCallback(
    (chatKeyStr: string): void => {
      if (!currentUsername) return;
      const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
      if (!chats[chatKeyStr]) return;
      if (!chats[chatKeyStr].disconnectRequests.includes(currentUsername)) {
        chats[chatKeyStr].disconnectRequests.push(currentUsername);
        writeJSON(KEY_CHATS, chats);
      }
    },
    [currentUsername],
  );

  const cleanupDisconnectedChat = useCallback((chatKeyStr: string): void => {
    const chats = readJSON<Record<string, ChatSession>>(KEY_CHATS, {});
    delete chats[chatKeyStr];
    writeJSON(KEY_CHATS, chats);
  }, []);

  // Keep online presence heartbeat while mounted
  useEffect(() => {
    if (!currentUser) return;
    // Don't auto-set online here — only when actively searching
  }, [currentUser]);

  return {
    currentUsername,
    currentUser,
    register,
    login,
    logout,
    addBalance,
    getBalance,
    setOnline,
    setOffline,
    setOnlineUser,
    setOfflineUser,
    getOnlineUsers,
    findMatch,
    getActiveChat,
    sendMessage,
    getMessages,
    getChatSession,
    requestDisconnect,
    approveDisconnect,
    cleanupDisconnectedChat,
    chatKey,
  };
}
