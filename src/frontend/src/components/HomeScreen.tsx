import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import {
  type Gender,
  getStoredBalance,
  getStoredSession,
  parseProfile,
  useChatterStore,
} from "@/hooks/useChatterStore";
import { LogOut, MessageCircleHeart, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { UserAvatar } from "./UserAvatar";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  onStartFinding: (gender: Gender) => void;
}

export function HomeScreen({ onNavigate, onStartFinding }: HomeScreenProps) {
  const { logout } = useChatterStore();
  const { actor } = useActor();

  const session = getStoredSession();
  const username = session?.username ?? "";
  const balance = getStoredBalance(username);

  const [displayName, setDisplayName] = useState(username);
  const [gender, setGender] = useState<Gender>("male");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");

  // Load profile from backend
  useEffect(() => {
    if (!actor) return;
    actor
      .getCallerUserProfile()
      .then((profile) => {
        if (!profile) return;
        const parsed = parseProfile(profile.username);
        if (!parsed) return;
        setDisplayName(parsed.displayName);
        setGender(parsed.gender);
        setCity(parsed.city);
        setOccupation(parsed.occupation);
      })
      .catch(() => {});
  }, [actor]);

  const handleLogout = async () => {
    await logout();
    onNavigate("auth");
  };

  const genderColor =
    gender === "male" ? "oklch(0.65 0.18 230)" : "oklch(0.72 0.18 350)";

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.3 0.06 250 / 0.4) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
              boxShadow: "0 0 16px oklch(0.62 0.18 210 / 0.4)",
            }}
          >
            <MessageCircleHeart className="h-4 w-4 text-white" />
          </div>
          <span
            className="font-display font-bold text-xl tracking-tight"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            TalkZy
          </span>
        </div>
        <Button
          data-ocid="home.delete_button"
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="h-9 w-9 rounded-full hover:bg-destructive/15 hover:text-destructive"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Avatar + Welcome */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="relative mb-4">
            <UserAvatar
              username={displayName}
              size="lg"
              className="h-20 w-20 text-2xl"
            />
            <div
              className="absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider"
              style={{
                background: genderColor,
                color: "white",
                fontSize: "9px",
              }}
            >
              {gender}
            </div>
          </div>
          <h2
            className="font-display text-2xl font-bold"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            Welcome back!
          </h2>
          <p
            className="text-base mt-0.5 font-semibold"
            style={{ color: genderColor }}
          >
            @{displayName}
          </p>
          {city && (
            <p
              className="text-xs mt-1"
              style={{ color: "oklch(0.55 0.04 255)" }}
            >
              {city}
              {occupation ? ` · ${occupation}` : ""}
            </p>
          )}
        </motion.div>

        {/* Action cards */}
        <div className="w-full max-w-sm space-y-4">
          {/* Recharge card */}
          <motion.button
            data-ocid="home.primary_button"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate("recharge")}
            className="w-full rounded-2xl p-5 text-left transition-all"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.26 0.04 255), oklch(0.22 0.03 255))",
              border: "1px solid oklch(0.35 0.04 255)",
              boxShadow: "0 4px 20px oklch(0.1 0.02 255 / 0.5)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.18 145), oklch(0.55 0.16 160))",
                  boxShadow: "0 4px 12px oklch(0.65 0.18 145 / 0.4)",
                }}
              >
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-display font-bold text-lg"
                  style={{ color: "oklch(0.95 0.01 255)" }}
                >
                  Recharge Account
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "oklch(0.6 0.05 255)" }}
                >
                  Balance:{" "}
                  <span
                    className="font-bold"
                    style={{ color: "oklch(0.72 0.18 145)" }}
                  >
                    ₹{balance}
                  </span>
                </p>
              </div>
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="oklch(0.5 0.04 255)"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </motion.button>

          {/* Chat with Female card */}
          <motion.button
            data-ocid="home.secondary_button"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStartFinding("female")}
            className="w-full rounded-2xl p-5 text-left transition-all"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.32 0.08 340), oklch(0.26 0.06 340))",
              border: "1px solid oklch(0.5 0.12 340 / 0.6)",
              boxShadow: "0 4px 24px oklch(0.55 0.14 340 / 0.3)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.72 0.18 350), oklch(0.62 0.2 340))",
                  boxShadow: "0 4px 12px oklch(0.72 0.18 350 / 0.5)",
                }}
              >
                ♀
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-display font-bold text-lg"
                  style={{ color: "oklch(0.95 0.01 255)" }}
                >
                  Chat with Female
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "oklch(0.72 0.1 340)" }}
                >
                  Connect with a female user online
                </p>
              </div>
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="oklch(0.7 0.1 340)"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </motion.button>

          {/* Chat with Male card */}
          <motion.button
            data-ocid="home.secondary_button"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStartFinding("male")}
            className="w-full rounded-2xl p-5 text-left transition-all"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.28 0.08 220), oklch(0.22 0.06 230))",
              border: "1px solid oklch(0.5 0.12 220 / 0.6)",
              boxShadow: "0 4px 24px oklch(0.55 0.16 210 / 0.3)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.18 230), oklch(0.55 0.2 220))",
                  boxShadow: "0 4px 12px oklch(0.65 0.18 230 / 0.5)",
                }}
              >
                ♂
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-display font-bold text-lg"
                  style={{ color: "oklch(0.95 0.01 255)" }}
                >
                  Chat with Male
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "oklch(0.72 0.1 220)" }}
                >
                  Connect with a male user online
                </p>
              </div>
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="oklch(0.7 0.1 220)"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </motion.button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center">
        <p className="text-xs" style={{ color: "oklch(0.4 0.02 255)" }}>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "oklch(0.55 0.06 210)" }}
          >
            Built with caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
