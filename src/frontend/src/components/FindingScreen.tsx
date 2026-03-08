import { Button } from "@/components/ui/button";
import { useChatterStore } from "@/hooks/useChatterStore";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface FindingScreenProps {
  onNavigate: (screen: Screen) => void;
  onMatchFound: (partnerUsername: string, chatKeyStr: string) => void;
}

export function FindingScreen({
  onNavigate,
  onMatchFound,
}: FindingScreenProps) {
  const {
    currentUser,
    setOnline,
    setOffline,
    findMatch,
    getActiveChat,
    chatKey,
  } = useChatterStore();
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"searching" | "timeout">("searching");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!currentUser) return;

    // Register self as online
    setOnline();

    // Heartbeat to keep presence fresh
    const heartbeat = setInterval(() => {
      setOnline();
    }, 5000);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= 30) {
        setStatus("timeout");
        clearInterval(timerRef.current!);
        clearInterval(pollRef.current!);
        clearInterval(heartbeat);
        setOffline();
      }
    }, 1000);

    // Poll for match every 2 seconds
    pollRef.current = setInterval(() => {
      // First check if someone else already created a session with us
      const existingChat = getActiveChat();
      if (existingChat) {
        cleanup(heartbeat);
        onMatchFound(existingChat.partner, existingChat.key);
        return;
      }

      // Try to create a match
      const partner = findMatch();
      if (partner) {
        const key = chatKey(currentUser.username, partner);
        cleanup(heartbeat);
        onMatchFound(partner, key);
      }
    }, 2000);

    function cleanup(hb: ReturnType<typeof setInterval>) {
      clearInterval(timerRef.current!);
      clearInterval(pollRef.current!);
      clearInterval(hb);
    }

    return () => {
      clearInterval(timerRef.current!);
      clearInterval(pollRef.current!);
      clearInterval(heartbeat);
      setOffline();
    };
  }, [
    currentUser,
    setOnline,
    setOffline,
    findMatch,
    getActiveChat,
    chatKey,
    onMatchFound,
  ]);

  const handleCancel = () => {
    setOffline();
    onNavigate("home");
  };

  const handleTryAgain = () => {
    setStatus("searching");
    setElapsed(0);
    startTimeRef.current = Date.now();
    setOnline();

    // Restart timers
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= 30) {
        setStatus("timeout");
        clearInterval(timerRef.current!);
        clearInterval(pollRef.current!);
        setOffline();
      }
    }, 1000);

    pollRef.current = setInterval(() => {
      if (!currentUser) return;
      const existingChat = getActiveChat();
      if (existingChat) {
        clearInterval(timerRef.current!);
        clearInterval(pollRef.current!);
        onMatchFound(existingChat.partner, existingChat.key);
        return;
      }
      const partner = findMatch();
      if (partner) {
        const key = chatKey(currentUser.username, partner);
        clearInterval(timerRef.current!);
        clearInterval(pollRef.current!);
        onMatchFound(partner, key);
      }
    }, 2000);
  };

  const targetGender = currentUser?.gender === "male" ? "female" : "male";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.3 0.08 220 / 0.35) 0%, transparent 70%)",
        }}
      />

      {/* Back button */}
      <div className="absolute top-6 left-6">
        <Button
          data-ocid="finding.cancel_button"
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="h-9 w-9 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {status === "searching" ? (
          <motion.div
            key="searching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-8 relative z-10"
          >
            {/* Pulsing radar */}
            <div className="relative flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border"
                  style={{
                    borderColor: "oklch(0.62 0.18 210 / 0.4)",
                    width: `${80 + i * 50}px`,
                    height: `${80 + i * 50}px`,
                  }}
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 2.4,
                    delay: i * 0.8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
              ))}
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center z-10 relative"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
                  boxShadow: "0 0 32px oklch(0.62 0.18 210 / 0.5)",
                }}
              >
                <span className="text-2xl">🔍</span>
              </div>
            </div>

            <div className="text-center">
              <h2
                className="font-display font-bold text-2xl"
                style={{ color: "oklch(0.95 0.01 255)" }}
              >
                Finding your match...
              </h2>
              <p
                className="text-sm mt-2"
                style={{ color: "oklch(0.6 0.06 220)" }}
              >
                Looking for {targetGender} users online
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: "oklch(0.62 0.18 210)" }}
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                  transition={{
                    duration: 1,
                    delay: i * 0.2,
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              ))}
            </div>

            <p
              className="text-xs tabular-nums"
              style={{ color: "oklch(0.5 0.04 255)" }}
            >
              {elapsed}s elapsed · Times out in {30 - elapsed}s
            </p>

            <Button
              data-ocid="finding.cancel_button"
              variant="ghost"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="timeout"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 text-center relative z-10 max-w-sm"
          >
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center"
              style={{
                background: "oklch(0.25 0.03 255)",
                border: "1px solid oklch(0.35 0.04 255)",
              }}
            >
              <span className="text-4xl">😔</span>
            </div>
            <div>
              <h2
                className="font-display font-bold text-xl"
                style={{ color: "oklch(0.95 0.01 255)" }}
              >
                No one available right now
              </h2>
              <p
                className="text-sm mt-2"
                style={{ color: "oklch(0.6 0.04 255)" }}
              >
                There are no {targetGender} users online. Try again in a moment!
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                data-ocid="finding.primary_button"
                onClick={handleTryAgain}
                className="w-full font-semibold btn-glow"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
                  color: "white",
                  border: "none",
                }}
              >
                Try Again
              </Button>
              <Button
                data-ocid="finding.secondary_button"
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Back to Home
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
