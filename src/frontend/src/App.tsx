import { Toaster } from "@/components/ui/sonner";
import { useActor } from "@/hooks/useActor";
import type { Gender } from "@/hooks/useChatterStore";
import { getStoredSession } from "@/hooks/useChatterStore";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { Loader2, MessageCircleHeart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { FindingScreen } from "./components/FindingScreen";
import { HomeScreen } from "./components/HomeScreen";
import { PaymentScreen } from "./components/PaymentScreen";
import { RechargeScreen } from "./components/RechargeScreen";
import { parseProfile } from "./hooks/useChatterStore";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface ChatContext {
  partnerDisplayName: string;
  partnerPrincipalText: string;
}

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();

  const [screen, setScreen] = useState<Screen>("auth");
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);
  const [findingTargetGender, setFindingTargetGender] =
    useState<Gender>("female");
  const [appReady, setAppReady] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    if (isInitializing || actorFetching) return;

    const session = getStoredSession();
    if (!session || !identity || !actor) {
      setAppReady(true);
      setScreen("auth");
      return;
    }

    // Verify the session principal matches the current II identity
    const currentPrincipal = identity.getPrincipal().toText();
    if (session.principalText !== currentPrincipal) {
      // Different device or cleared II — show auth
      setAppReady(true);
      setScreen("auth");
      return;
    }

    // Verify backend profile exists
    actor
      .getCallerUserProfile()
      .then((profile) => {
        if (profile) {
          const parsed = parseProfile(profile.username);
          if (parsed && parsed.displayName === session.username) {
            setScreen("home");
          } else {
            setScreen("auth");
          }
        } else {
          setScreen("auth");
        }
        setAppReady(true);
      })
      .catch(() => {
        setAppReady(true);
        setScreen("auth");
      });
  }, [isInitializing, actorFetching, identity, actor]);

  const handleNavigate = (nextScreen: Screen) => {
    setScreen(nextScreen);
  };

  const handleStartFinding = (gender: Gender) => {
    setFindingTargetGender(gender);
    setScreen("finding");
  };

  const handleMatchFound = (
    partnerDisplayName: string,
    partnerPrincipalText: string,
  ) => {
    setChatContext({ partnerDisplayName, partnerPrincipalText });
    setScreen("chat");
  };

  const handleAuthSuccess = () => {
    setScreen("home");
  };

  // Show loading while app initializes
  if (!appReady || isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
            boxShadow: "0 0 40px oklch(0.62 0.18 210 / 0.5)",
          }}
        >
          <MessageCircleHeart className="h-8 w-8 text-white" />
        </div>
        <span
          className="font-display font-bold text-2xl tracking-tight"
          style={{ color: "oklch(0.95 0.01 255)" }}
        >
          TalkZy
        </span>
        <div
          className="flex items-center gap-2"
          style={{ color: "oklch(0.6 0.04 255)" }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen"
        >
          {screen === "auth" && <AuthScreen onSuccess={handleAuthSuccess} />}
          {screen === "home" && (
            <HomeScreen
              onNavigate={handleNavigate}
              onStartFinding={handleStartFinding}
            />
          )}
          {screen === "recharge" && (
            <RechargeScreen onNavigate={handleNavigate} />
          )}
          {screen === "payment" && (
            <PaymentScreen onNavigate={handleNavigate} />
          )}
          {screen === "finding" && (
            <FindingScreen
              onNavigate={handleNavigate}
              onMatchFound={handleMatchFound}
              targetGender={findingTargetGender}
            />
          )}
          {screen === "chat" && chatContext && (
            <ChatScreen
              partnerDisplayName={chatContext.partnerDisplayName}
              partnerPrincipalText={chatContext.partnerPrincipalText}
              onNavigate={handleNavigate}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <Toaster position="top-center" />
    </div>
  );
}
