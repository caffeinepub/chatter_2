import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Message {
    isDeleted: boolean;
    content: MessageType;
    recipient: Principal;
    isRead: boolean;
    sender: Principal;
    timestamp: Time;
}
export type Time = bigint;
export type MessageType = {
    __kind__: "audio";
    audio: Uint8Array;
} | {
    __kind__: "text";
    text: string;
};
export interface UserProfile {
    username: string;
    createdAt: Time;
}
export interface Conversation {
    withUser: Principal;
    messages: Array<Message>;
    unreadCount: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllMessages(): Promise<Array<Message>>;
    getAllUsers(): Promise<Array<UserProfile>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getConversation(withUser: Principal): Promise<Conversation>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listConversations(): Promise<Array<Conversation>>;
    markAsRead(withUser: Principal): Promise<void>;
    registerUser(username: string): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    sendMessage(recipient: Principal, content: MessageType): Promise<string>;
}
