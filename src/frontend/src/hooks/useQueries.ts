import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageType, UserProfile } from "../backend.d";
import { useActor } from "./useActor";

// ── User Profile ─────────────────────────────────────────
export function useCallerProfile() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["callerProfile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllUsers() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllUsers();
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * getAllMessages() returns all messages with sender/recipient as Principal.
 * We use this to extract unique user principals and their profiles.
 */
export function useAllContacts(currentPrincipal: string) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["allContacts", currentPrincipal],
    queryFn: async () => {
      if (!actor)
        return [] as Array<{
          principal: Principal;
          profile: UserProfile | null;
        }>;

      const messages = await actor.getAllMessages();

      // Extract unique principals (exclude self)
      const seen = new Set<string>();
      const principals: Principal[] = [];
      for (const msg of messages) {
        for (const p of [msg.sender, msg.recipient]) {
          const t = p.toText();
          if (t !== currentPrincipal && !seen.has(t)) {
            seen.add(t);
            principals.push(p);
          }
        }
      }

      // Fetch profiles in parallel
      const results = await Promise.all(
        principals.map(async (p) => {
          const profile = await actor.getUserProfile(p);
          return { principal: p, profile };
        }),
      );

      return results.filter(
        (r): r is { principal: Principal; profile: UserProfile } =>
          r.profile !== null,
      );
    },
    enabled: !!actor && !isFetching && !!currentPrincipal,
  });
}

// ── Conversations ─────────────────────────────────────────
export function useConversations() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listConversations();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000,
  });
}

export function useConversation(withUser: Principal | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["conversation", withUser?.toText()],
    queryFn: async () => {
      if (!actor || !withUser) return null;
      return actor.getConversation(withUser);
    },
    enabled: !!actor && !isFetching && !!withUser,
    refetchInterval: 3000,
  });
}

export function useUserProfile(user: Principal | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["userProfile", user?.toText()],
    queryFn: async () => {
      if (!actor || !user) return null;
      return actor.getUserProfile(user);
    },
    enabled: !!actor && !isFetching && !!user,
  });
}

// ── Mutations ─────────────────────────────────────────────
export function useRegisterUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor) throw new Error("No actor");
      return actor.registerUser(username);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callerProfile"] });
    },
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipient,
      content,
    }: {
      recipient: Principal;
      content: MessageType;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.sendMessage(recipient, content);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", variables.recipient.toText()],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["allContacts"] });
    },
  });
}

export function useMarkAsRead() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (withUser: Principal) => {
      if (!actor) throw new Error("No actor");
      return actor.markAsRead(withUser);
    },
    onSuccess: (_data, withUser) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", withUser.toText()],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
