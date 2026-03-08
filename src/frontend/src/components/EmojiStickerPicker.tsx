import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "motion/react";

interface EmojiStickerPickerProps {
  onSelect: (type: "emoji" | "sticker", content: string) => void;
}

const EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😍",
  "🤩",
  "😎",
  "🥳",
  "😇",
  "🤔",
  "😏",
  "😒",
  "🙄",
  "😤",
  "🤯",
  "😱",
  "🥺",
  "😭",
  "😢",
  "😅",
  "😬",
  "🤗",
  "🤭",
  "😴",
  "🤤",
  "👋",
  "🤚",
  "✋",
  "🤙",
  "👍",
  "👎",
  "❤️",
  "💙",
  "💚",
  "💛",
  "🧡",
  "💜",
  "🖤",
  "🤍",
  "💔",
  "✨",
  "🔥",
  "💯",
  "🎉",
  "🎊",
  "🙌",
  "👏",
  "💪",
  "🌟",
];

const STICKERS = [
  { id: "wave", emoji: "👋", label: "Hello!", bg: "oklch(0.45 0.12 210)" },
  { id: "heart", emoji: "❤️", label: "Love it!", bg: "oklch(0.45 0.18 20)" },
  { id: "laugh", emoji: "😂", label: "LOL", bg: "oklch(0.5 0.14 80)" },
  { id: "wow", emoji: "😱", label: "Wow!", bg: "oklch(0.45 0.12 280)" },
  { id: "cool", emoji: "😎", label: "Cool", bg: "oklch(0.4 0.1 195)" },
  { id: "sad", emoji: "😢", label: "Sad", bg: "oklch(0.4 0.1 240)" },
  { id: "angry", emoji: "😤", label: "Grr", bg: "oklch(0.45 0.18 25)" },
  { id: "hug", emoji: "🤗", label: "Hug", bg: "oklch(0.5 0.14 60)" },
  { id: "ok", emoji: "👍", label: "OK!", bg: "oklch(0.5 0.14 145)" },
  { id: "no", emoji: "👎", label: "Nah", bg: "oklch(0.45 0.12 30)" },
  { id: "fire", emoji: "🔥", label: "Fire!", bg: "oklch(0.5 0.16 45)" },
  { id: "star", emoji: "⭐", label: "Star!", bg: "oklch(0.55 0.16 90)" },
];

export function EmojiStickerPicker({ onSelect }: EmojiStickerPickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden shadow-xl"
      style={{
        background: "oklch(0.22 0.03 255)",
        border: "1px solid oklch(0.3 0.03 255)",
        width: "280px",
      }}
    >
      <Tabs defaultValue="emoji">
        <TabsList
          className="w-full rounded-none border-b h-10 bg-transparent px-3 gap-1"
          style={{ borderColor: "oklch(0.28 0.028 255)" }}
        >
          <TabsTrigger
            value="emoji"
            data-ocid="chat.tab"
            className="flex-1 h-8 text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg"
          >
            Emoji
          </TabsTrigger>
          <TabsTrigger
            value="sticker"
            data-ocid="chat.tab"
            className="flex-1 h-8 text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg"
          >
            Stickers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emoji" className="mt-0 p-2">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect("emoji", emoji)}
                className="h-8 w-8 rounded-lg text-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sticker" className="mt-0 p-2">
          <div className="grid grid-cols-4 gap-2">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSelect("sticker", sticker.id)}
                className="rounded-xl p-2 flex flex-col items-center gap-1 transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `${sticker.bg}30`,
                  border: `1px solid ${sticker.bg}60`,
                }}
              >
                <span className="text-2xl">{sticker.emoji}</span>
                <span
                  className="text-[9px] font-medium"
                  style={{ color: "oklch(0.7 0.04 255)" }}
                >
                  {sticker.label}
                </span>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

// Helper to render sticker content in chat
export function getStickerContent(stickerId: string): {
  emoji: string;
  label: string;
} {
  const sticker = STICKERS.find((s) => s.id === stickerId);
  return sticker
    ? { emoji: sticker.emoji, label: sticker.label }
    : { emoji: "🎭", label: stickerId };
}
