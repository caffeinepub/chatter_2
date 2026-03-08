import { Toaster } from "@/components/ui/sonner";
import { useChatterStore } from "@/hooks/useChatterStore";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { FindingScreen } from "./components/FindingScreen";
import { HomeScreen } from "./components/HomeScreen";
import { PaymentScreen } from "./components/PaymentScreen";
import { RechargeScreen } from "./components/RechargeScreen";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface ChatContext {
  partnerUsername: string;
  chatKeyStr: string;
}

export default function App() {
  const { currentUsername } = useChatterStore();

  const [screen, setScreen] = useState<Screen>(() =>
    currentUsername ? "home" : "auth",
  );
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  const handleNavigate = (nextScreen: Screen) => {
    setScreen(nextScreen);
  };

  const handleMatchFound = (partnerUsername: string, chatKeyStr: string) => {
    setChatContext({ partnerUsername, chatKeyStr });
    setScreen("chat");
  };

  const handleAuthSuccess = () => {
    setScreen("home");
  };

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
          {screen === "home" && <HomeScreen onNavigate={handleNavigate} />}
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
            />
          )}
          {screen === "chat" && chatContext && (
            <ChatScreen
              partnerUsername={chatContext.partnerUsername}
              chatKeyStr={chatContext.chatKeyStr}
              onNavigate={handleNavigate}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <Toaster position="top-center" />
    </div>
  );
}
