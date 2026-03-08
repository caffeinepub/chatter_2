import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatterStore } from "@/hooks/useChatterStore";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { Image, Loader2, Mic, PhoneOff, Send, Smile, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Message } from "../backend.d";
import { AudioMessage } from "./AudioMessage";
import { EmojiStickerPicker, getStickerContent } from "./EmojiStickerPicker";
import { UserAvatar } from "./UserAvatar";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface ChatScreenProps {
  partnerDisplayName: string;
  partnerPrincipalText: string;
  onNavigate: (screen: Screen) => void;
}

function formatTime(ns: bigint): string {
  const ms = Number(ns) / 1_000_000;
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MsgRenderType =
  | "text"
  | "image"
  | "audio"
  | "emoji"
  | "sticker"
  | "system";

interface ParsedMessage {
  id: string;
  senderPrincipal: string;
  type: MsgRenderType;
  content: string;
  timestamp: bigint;
}

function parseBackendMessage(msg: Message): ParsedMessage {
  const id = `${msg.timestamp}_${msg.sender.toText().slice(-6)}`;
  const senderPrincipal = msg.sender.toText();
  const ts = msg.timestamp;

  if (msg.content.__kind__ === "audio") {
    // Convert Uint8Array to base64
    let binary = "";
    const bytes = msg.content.audio;
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return {
      id,
      senderPrincipal,
      type: "audio",
      content: `data:audio/webm;base64,${b64}`,
      timestamp: ts,
    };
  }

  const text = msg.content.text;

  if (text.startsWith("__IMAGE__:")) {
    return {
      id,
      senderPrincipal,
      type: "image",
      content: text.slice("__IMAGE__:".length),
      timestamp: ts,
    };
  }
  if (text.startsWith("__VOICE__:")) {
    const b64 = text.slice("__VOICE__:".length);
    return {
      id,
      senderPrincipal,
      type: "audio",
      content: `data:audio/webm;base64,${b64}`,
      timestamp: ts,
    };
  }
  if (text.startsWith("__SYSTEM__:")) {
    return {
      id,
      senderPrincipal,
      type: "system",
      content: text.slice("__SYSTEM__:".length),
      timestamp: ts,
    };
  }
  if (text.startsWith("__EMOJI__:")) {
    return {
      id,
      senderPrincipal,
      type: "emoji",
      content: text.slice("__EMOJI__:".length),
      timestamp: ts,
    };
  }
  if (text.startsWith("__STICKER__:")) {
    return {
      id,
      senderPrincipal,
      type: "sticker",
      content: text.slice("__STICKER__:".length),
      timestamp: ts,
    };
  }

  return { id, senderPrincipal, type: "text", content: text, timestamp: ts };
}

function MessageBubble({
  msg,
  isSent,
  index,
}: {
  msg: ParsedMessage;
  isSent: boolean;
  index: number;
}) {
  const renderContent = () => {
    switch (msg.type) {
      case "text":
        return (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {msg.content}
          </p>
        );
      case "emoji":
        return <span className="text-4xl leading-none">{msg.content}</span>;
      case "sticker": {
        const { emoji, label } = getStickerContent(msg.content);
        return (
          <div className="flex flex-col items-center gap-1 p-1">
            <span className="text-5xl leading-none">{emoji}</span>
            <span className="text-[10px] font-medium opacity-70">{label}</span>
          </div>
        );
      }
      case "image":
        return (
          // biome-ignore lint/a11y/useAltText: dynamic user image
          <img
            src={msg.content}
            className="max-w-[200px] rounded-xl object-cover"
            style={{ maxHeight: "200px" }}
          />
        );
      case "audio": {
        const base64 = msg.content.split(",")[1] ?? msg.content;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return <AudioMessage audio={bytes} isSent={isSent} />;
      }
      case "system":
        return null; // system messages are handled separately
      default:
        return <p className="text-sm">{msg.content}</p>;
    }
  };

  if (msg.type === "system") return null;

  return (
    <motion.div
      data-ocid={`chat.message.item.${index}`}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[75%] flex flex-col ${isSent ? "items-end" : "items-start"} gap-1`}
      >
        <div
          className={`px-3.5 py-2.5 rounded-2xl ${
            isSent
              ? "bubble-sent rounded-br-sm"
              : "bubble-received rounded-bl-sm"
          } ${msg.type === "sticker" || msg.type === "emoji" ? "bg-transparent shadow-none" : ""}`}
          style={
            msg.type === "sticker" || msg.type === "emoji"
              ? { background: "transparent", boxShadow: "none" }
              : undefined
          }
        >
          {renderContent()}
        </div>
        <span
          className="text-[10px] px-1"
          style={{ color: "oklch(0.55 0.04 255)" }}
        >
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}

export function ChatScreen({
  partnerDisplayName,
  partnerPrincipalText,
  onNavigate,
}: ChatScreenProps) {
  const {
    sendChatMessage,
    sendImageMessage,
    sendVoiceMessage,
    sendSystemMessage,
    getChatMessages,
    clearSeekingStatus,
  } = useChatterStore();

  const { identity } = useInternetIdentity();
  const myPrincipalText = identity?.getPrincipal().toText() ?? "";

  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [partnerDisconnectRequest, setPartnerDisconnectRequest] =
    useState(false);
  const [chatEnded, setChatEnded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgCountRef = useRef(0);

  // Clear seeking status from backend profile on mount
  useEffect(() => {
    clearSeekingStatus().catch(() => {});
  }, [clearSeekingStatus]);

  // Poll for new messages every 2s
  useEffect(() => {
    const refresh = async () => {
      const backendMsgs = await getChatMessages(partnerPrincipalText);
      const parsed = backendMsgs.map(parseBackendMessage);

      // Check for system messages
      for (const m of parsed) {
        if (m.type === "system" && m.senderPrincipal !== myPrincipalText) {
          if (m.content === "DISCONNECT_REQUEST") {
            setPartnerDisconnectRequest(true);
          } else if (
            m.content === "DISCONNECT_APPROVED" ||
            m.content === "DISCONNECT_COMPLETE"
          ) {
            setChatEnded(true);
          } else if (m.content === "DISCONNECT_DENIED") {
            setDisconnectPending(false);
            toast.info("Disconnect request denied. Continue chatting!");
          }
        }
      }

      // Filter out system messages for display
      const displayMsgs = parsed.filter((m) => m.type !== "system");
      setMessages(displayMsgs);

      if (displayMsgs.length > lastMsgCountRef.current) {
        lastMsgCountRef.current = displayMsgs.length;
      }
    };

    refresh();
    pollRef.current = setInterval(refresh, 2000);
    return () => clearInterval(pollRef.current!);
  }, [partnerPrincipalText, getChatMessages, myPrincipalText]);

  // Auto-scroll
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll when message count changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Handle chat ended
  useEffect(() => {
    if (chatEnded) {
      clearInterval(pollRef.current!);
      toast.success("Chat disconnected. You can start a new one!");
      onNavigate("home");
    }
  }, [chatEnded, onNavigate]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSendingMsg) return;
    setText("");
    setIsSendingMsg(true);
    try {
      await sendChatMessage(partnerPrincipalText, trimmed);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleEmojiSticker = async (
    type: "emoji" | "sticker",
    content: string,
  ) => {
    setShowPicker(false);
    try {
      const prefix = type === "emoji" ? "__EMOJI__:" : "__STICKER__:";
      await sendChatMessage(partnerPrincipalText, `${prefix}${content}`);
    } catch {
      toast.error("Failed to send");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Image must be under 1.5MB for chat transmission");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await sendImageMessage(partnerPrincipalText, dataUrl);
      } catch {
        toast.error("Failed to send image");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }
    setIsRecording(false);
    setIsSendingVoice(true);

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      for (const t of streamRef.current?.getTracks() ?? []) t.stop();
      streamRef.current = null;

      if (uint8.length === 0) {
        setIsSendingVoice(false);
        return;
      }

      // Convert to base64
      let binary = "";
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);

      try {
        await sendVoiceMessage(partnerPrincipalText, b64);
      } catch {
        toast.error("Failed to send voice message");
      }
      setIsSendingVoice(false);
    };
    recorder.stop();
  }, [partnerPrincipalText, sendVoiceMessage]);

  const handleDisconnectRequest = async () => {
    setDisconnectPending(true);
    toast.info("Disconnect request sent. Waiting for partner's approval...");
    try {
      await sendSystemMessage(partnerPrincipalText, "DISCONNECT_REQUEST");
    } catch {
      toast.error("Failed to send disconnect request");
      setDisconnectPending(false);
    }
  };

  const handleApproveDisconnect = async () => {
    try {
      await sendSystemMessage(partnerPrincipalText, "DISCONNECT_APPROVED");
      setChatEnded(true);
    } catch {
      toast.error("Failed to approve disconnect");
    }
  };

  const handleDenyDisconnect = async () => {
    setPartnerDisconnectRequest(false);
    try {
      await sendSystemMessage(partnerPrincipalText, "DISCONNECT_DENIED");
    } catch {
      // best effort
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 border-b"
        style={{
          background: "oklch(0.19 0.022 255 / 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "oklch(0.28 0.025 255)",
        }}
      >
        <UserAvatar username={partnerDisplayName} size="md" />
        <div className="flex-1 min-w-0">
          <p
            className="font-display font-bold truncate"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            {partnerDisplayName}
          </p>
          <p className="text-xs" style={{ color: "oklch(0.55 0.06 180)" }}>
            ● Online
          </p>
        </div>

        {/* Disconnect button */}
        {!disconnectPending ? (
          <Button
            data-ocid="chat.delete_button"
            variant="ghost"
            size="sm"
            onClick={handleDisconnectRequest}
            className="gap-1.5 text-xs hover:bg-destructive/15 hover:text-destructive h-8"
            style={{ color: "oklch(0.65 0.16 25)" }}
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        ) : (
          <div
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
            style={{
              background: "oklch(0.62 0.22 25 / 0.15)",
              color: "oklch(0.75 0.18 25)",
            }}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Waiting...
          </div>
        )}
      </div>

      {/* Disconnect approval banner */}
      <AnimatePresence>
        {partnerDisconnectRequest && !disconnectPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 px-4 py-3 flex items-center justify-between gap-3"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.35 0.1 25 / 0.4), oklch(0.35 0.1 30 / 0.3))",
              borderBottom: "1px solid oklch(0.5 0.15 25 / 0.4)",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: "oklch(0.88 0.1 25)" }}
            >
              <strong>{partnerDisplayName}</strong> wants to disconnect
            </p>
            <div className="flex gap-2">
              <Button
                data-ocid="chat.confirm_button"
                size="sm"
                onClick={handleApproveDisconnect}
                className="h-7 text-xs font-semibold shrink-0"
                style={{
                  background: "oklch(0.62 0.22 25)",
                  color: "white",
                  border: "none",
                }}
              >
                Accept
              </Button>
              <Button
                data-ocid="chat.cancel_button"
                size="sm"
                variant="ghost"
                onClick={handleDenyDisconnect}
                className="h-7 text-xs font-semibold shrink-0"
              >
                Deny
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-2">
          {messages.length === 0 ? (
            <motion.div
              data-ocid="chat.empty_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "oklch(0.22 0.025 255)" }}
              >
                <span className="text-3xl">👋</span>
              </div>
              <p
                className="font-display font-semibold"
                style={{ color: "oklch(0.65 0.04 255)" }}
              >
                You're connected!
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "oklch(0.5 0.03 255)" }}
              >
                Say hello to {partnerDisplayName}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isSent={msg.senderPrincipal === myPrincipalText}
                  index={i + 1}
                />
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2 py-2 border-t shrink-0"
            style={{
              background: "oklch(0.62 0.22 25 / 0.1)",
              borderColor: "oklch(0.5 0.15 25 / 0.3)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full recording-active"
              style={{ background: "oklch(0.62 0.22 25)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "oklch(0.75 0.18 25)" }}
            >
              Recording… release to send
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji/Sticker picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            className="absolute bottom-[72px] left-4 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmojiStickerPicker onSelect={handleEmojiSticker} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close picker */}
      {showPicker && (
        <button
          type="button"
          className="fixed inset-0 z-10"
          onClick={() => setShowPicker(false)}
          aria-label="Close picker"
          tabIndex={-1}
        />
      )}

      {/* Input bar */}
      <div
        className="px-3 py-3 border-t shrink-0 relative z-30"
        style={{
          background: "oklch(0.19 0.022 255 / 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "oklch(0.28 0.025 255)",
        }}
      >
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          {/* Emoji/Sticker toggle */}
          <Button
            type="button"
            data-ocid="chat.toggle"
            variant="ghost"
            size="icon"
            onClick={() => setShowPicker((v) => !v)}
            className={`h-9 w-9 rounded-full shrink-0 transition-all ${showPicker ? "bg-primary/20 text-primary" : ""}`}
          >
            {showPicker ? (
              <X className="h-4 w-4" />
            ) : (
              <Smile className="h-4 w-4" />
            )}
          </Button>

          {/* Image upload */}
          <Button
            type="button"
            data-ocid="chat.upload_button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 rounded-full shrink-0"
          >
            <Image className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Text input */}
          <Input
            data-ocid="chat.input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${partnerDisplayName}…`}
            className="flex-1 h-9 text-sm bg-input/50 border-border/60"
            style={{ color: "oklch(var(--foreground))" }}
          />

          {/* Send / Mic */}
          {text.trim() ? (
            <Button
              type="submit"
              data-ocid="chat.primary_button"
              size="icon"
              disabled={isSendingMsg}
              className="h-9 w-9 rounded-full btn-glow shrink-0"
              style={{
                background: "oklch(0.62 0.18 210)",
                color: "white",
                border: "none",
              }}
            >
              {isSendingMsg ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              data-ocid="chat.secondary_button"
              size="icon"
              disabled={isSendingVoice}
              className={`h-9 w-9 rounded-full shrink-0 transition-all select-none ${isRecording ? "recording-active" : ""}`}
              style={{
                background: isRecording
                  ? "oklch(0.62 0.22 25)"
                  : "oklch(0.26 0.028 255)",
                color: isRecording ? "white" : "oklch(0.58 0.04 255)",
                border: "none",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                startRecording();
              }}
              onMouseUp={(e) => {
                e.preventDefault();
                if (isRecording) stopRecording();
              }}
              onMouseLeave={(e) => {
                e.preventDefault();
                if (isRecording) stopRecording();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                startRecording();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (isRecording) stopRecording();
              }}
              title="Hold to record"
            >
              {isSendingVoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
