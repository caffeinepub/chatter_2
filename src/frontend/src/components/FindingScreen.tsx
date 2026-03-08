import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import {
  type Gender,
  getStoredSession,
  parseProfile,
  useChatterStore,
} from "@/hooks/useChatterStore";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface FindingScreenProps {
  onNavigate: (screen: Screen) => void;
  onMatchFound: (
    partnerDisplayName: string,
    partnerPrincipalText: string,
  ) => void;
  targetGender: Gender;
}

const TIMEOUT_SECS = 59;
const POLL_INTERVAL = 2500;

export function FindingScreen({
  onNavigate,
  onMatchFound,
  targetGender,
}: FindingScreenProps) {
  const {
    setSeekingStatus,
    clearSeekingStatus,
    findPotentialMatch,
    acceptMatch,
    pollForMatch,
  } = useChatterStore();
  const { actor } = useActor();

  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"searching" | "timeout">("searching");
  const [phase, setPhase] = useState<"seeking" | "accepting" | "waiting">(
    "seeking",
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const matchedRef = useRef(false);
  const cleanedUpRef = useRef(false);

  const session = getStoredSession();
  const myDisplayName = session?.username ?? "";

  const cleanup = useCallback(
    async (clearStatus = true) => {
      if (cleanedUpRef.current) return;
      cleanedUpRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (clearStatus) {
        await clearSeekingStatus();
      }
    },
    [clearSeekingStatus],
  );

  const startSearch = useCallback(async () => {
    if (!actor || !myDisplayName) return;
    cleanedUpRef.current = false;
    matchedRef.current = false;

    // Register ourselves as seeking
    setPhase("seeking");
    await setSeekingStatus(targetGender);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= TIMEOUT_SECS) {
        setStatus("timeout");
        cleanup(true);
      }
    }, 1000);

    // Poll for match
    pollRef.current = setInterval(async () => {
      if (matchedRef.current) return;

      try {
        // First: check if someone already matched with us (they responded to our SEEKING)
        const incomingMatch = await pollForMatch(myDisplayName);
        if (incomingMatch && !matchedRef.current) {
          matchedRef.current = true;
          setPhase("accepting");
          await cleanup(false); // Don't clear our profile yet — chat will clear it
          // Navigate to chat
          onMatchFound(
            incomingMatch.partner.displayName,
            incomingMatch.partner.principalText,
          );
          return;
        }

        // Second: look for a seeking user we can match with
        const candidate = await findPotentialMatch(targetGender, myDisplayName);
        if (candidate && !matchedRef.current) {
          matchedRef.current = true;
          setPhase("accepting");
          // Accept the match — update our profile to MATCHED
          const { ok } = await acceptMatch(candidate);
          if (!ok) {
            matchedRef.current = false;
            setPhase("seeking");
            return;
          }
          await cleanup(false);
          onMatchFound(candidate.displayName, candidate.principalText);
        }
      } catch (err) {
        console.error("Matching error:", err);
      }
    }, POLL_INTERVAL);
  }, [
    actor,
    myDisplayName,
    targetGender,
    setSeekingStatus,
    findPotentialMatch,
    acceptMatch,
    pollForMatch,
    cleanup,
    onMatchFound,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: startSearch is memoized
  useEffect(() => {
    if (!actor) return;
    startSearch();
    return () => {
      if (!matchedRef.current) {
        cleanup(true);
      }
    };
  }, [actor]);

  const handleCancel = async () => {
    await cleanup(true);
    onNavigate("home");
  };

  const handleTryAgain = async () => {
    setStatus("searching");
    setElapsed(0);
    startTimeRef.current = Date.now();
    cleanedUpRef.current = false;
    matchedRef.current = false;
    await startSearch();
  };

  const genderLabel = targetGender === "male" ? "male" : "female";
  const genderColor =
    targetGender === "male" ? "oklch(0.65 0.18 230)" : "oklch(0.72 0.18 350)";

  const phaseText =
    phase === "accepting"
      ? "Match found! Connecting..."
      : phase === "waiting"
        ? "Waiting for partner..."
        : `Looking for ${genderLabel} users online`;

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
                    borderColor: genderColor
                      .replace(")", " / 0.4)")
                      .replace("oklch(", "oklch("),
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
                  background: `linear-gradient(135deg, ${genderColor}, oklch(0.52 0.22 280))`,
                  boxShadow: `0 0 32px ${genderColor.replace(")", " / 0.5)").replace("oklch(", "oklch(")}`,
                }}
              >
                <span className="text-2xl">
                  {targetGender === "male" ? "♂" : "♀"}
                </span>
              </div>
            </div>

            <div className="text-center">
              <h2
                className="font-display font-bold text-2xl"
                style={{ color: "oklch(0.95 0.01 255)" }}
              >
                {phase === "accepting"
                  ? "Match found!"
                  : "Finding your match..."}
              </h2>
              <p className="text-sm mt-2" style={{ color: genderColor }}>
                {phaseText}
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: genderColor }}
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
              {elapsed}s elapsed · Times out in{" "}
              {Math.max(0, TIMEOUT_SECS - elapsed)}s
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
                No {genderLabel} users are online. Try again in a moment!
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button
                data-ocid="finding.primary_button"
                onClick={handleTryAgain}
                className="w-full font-semibold btn-glow"
                style={{
                  background: `linear-gradient(135deg, ${genderColor}, oklch(0.52 0.22 280))`,
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
