import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ChatMessage,
  type ChatSession,
  useChatterStore,
} from "@/hooks/useChatterStore";
import { Image, Loader2, Mic, PhoneOff, Send, Smile, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioMessage } from "./AudioMessage";
import { EmojiStickerPicker, getStickerContent } from "./EmojiStickerPicker";
import { UserAvatar } from "./UserAvatar";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface ChatScreenProps {
  partnerUsername: string;
  chatKeyStr: string;
  onNavigate: (screen: Screen) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({
  msg,
  isSent,
  index,
}: {
  msg: ChatMessage;
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
        // Convert dataURL back to Uint8Array
        const base64 = msg.content.split(",")[1] ?? msg.content;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return <AudioMessage audio={bytes} isSent={isSent} />;
      }
      default:
        return <p className="text-sm">{msg.content}</p>;
    }
  };

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
  partnerUsername,
  chatKeyStr,
  onNavigate,
}: ChatScreenProps) {
  const {
    currentUsername,
    sendMessage,
    getMessages,
    getChatSession,
    requestDisconnect,
    approveDisconnect,
    cleanupDisconnectedChat,
    setOffline,
  } = useChatterStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for new messages and session state every 1.5s
  useEffect(() => {
    const refresh = () => {
      const msgs = getMessages(chatKeyStr);
      setMessages([...msgs]);
      const sess = getChatSession(chatKeyStr);
      setSession(sess);

      // Both users requested disconnect => auto-complete
      if (sess && sess.disconnectRequests.length >= 2) {
        clearInterval(pollRef.current!);
        cleanupDisconnectedChat(chatKeyStr);
        setOffline();
        toast.success("Chat disconnected. You can start a new one!");
        onNavigate("home");
      }
    };

    refresh();
    pollRef.current = setInterval(refresh, 1500);
    return () => clearInterval(pollRef.current!);
  }, [
    chatKeyStr,
    getMessages,
    getChatSession,
    cleanupDisconnectedChat,
    setOffline,
    onNavigate,
  ]);

  // Auto-scroll
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — scroll when message count changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const partnerRequestedDisconnect =
    session?.disconnectRequests.includes(partnerUsername) &&
    !session.disconnectRequests.includes(currentUsername ?? "");

  const iRequestedDisconnect =
    session?.disconnectRequests.includes(currentUsername ?? "") ?? false;

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUsername) return;
    setText("");
    sendMessage(chatKeyStr, {
      senderUsername: currentUsername,
      type: "text",
      content: trimmed,
    });
  };

  const handleEmojiSticker = (type: "emoji" | "sticker", content: string) => {
    if (!currentUsername) return;
    setShowPicker(false);
    sendMessage(chatKeyStr, { senderUsername: currentUsername, type, content });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUsername) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      sendMessage(chatKeyStr, {
        senderUsername: currentUsername,
        type: "image",
        content: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    // Reset file input
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

      // Stop tracks
      for (const t of streamRef.current?.getTracks() ?? []) t.stop();
      streamRef.current = null;

      if (uint8.length === 0 || !currentUsername) {
        setIsSendingVoice(false);
        return;
      }

      // Convert to base64 dataURL
      let binary = "";
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const dataUrl = `data:audio/webm;base64,${btoa(binary)}`;
      sendMessage(chatKeyStr, {
        senderUsername: currentUsername,
        type: "audio",
        content: dataUrl,
      });
      setIsSendingVoice(false);
    };
    recorder.stop();
  }, [currentUsername, chatKeyStr, sendMessage]);

  const handleDisconnectRequest = () => {
    if (!currentUsername) return;
    requestDisconnect(chatKeyStr);
    setDisconnectPending(true);
    toast.info("Disconnect request sent. Waiting for partner's approval...");
  };

  const handleApproveDisconnect = () => {
    if (!currentUsername) return;
    approveDisconnect(chatKeyStr);
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
        <UserAvatar username={partnerUsername} size="md" />
        <div className="flex-1 min-w-0">
          <p
            className="font-display font-bold truncate"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            {partnerUsername}
          </p>
          <p className="text-xs" style={{ color: "oklch(0.55 0.06 180)" }}>
            ● Online
          </p>
        </div>

        {/* Disconnect button */}
        {!iRequestedDisconnect && !disconnectPending ? (
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

      {/* Disconnect request banner (partner asked) */}
      <AnimatePresence>
        {partnerRequestedDisconnect && (
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
              <strong>{partnerUsername}</strong> wants to disconnect
            </p>
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
                Say hello to {partnerUsername}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isSent={msg.senderUsername === currentUsername}
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
            placeholder={`Message ${partnerUsername}…`}
            className="flex-1 h-9 text-sm bg-input/50 border-border/60"
            style={{ color: "oklch(var(--foreground))" }}
          />

          {/* Send / Mic */}
          {text.trim() ? (
            <Button
              type="submit"
              data-ocid="chat.primary_button"
              size="icon"
              className="h-9 w-9 rounded-full btn-glow shrink-0"
              style={{
                background: "oklch(0.62 0.18 210)",
                color: "white",
                border: "none",
              }}
            >
              <Send className="h-4 w-4" />
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
