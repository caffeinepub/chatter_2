import { Button } from "@/components/ui/button";
import { getStoredBalance, getStoredSession } from "@/hooks/useChatterStore";
import { ArrowLeft, Wallet, Zap } from "lucide-react";
import { motion } from "motion/react";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface RechargeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function RechargeScreen({ onNavigate }: RechargeScreenProps) {
  const session = getStoredSession();
  const balance = getStoredBalance(session?.username ?? "");

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.4 0.1 150 / 0.2) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-6 pt-6 pb-4">
        <Button
          data-ocid="recharge.cancel_button"
          variant="ghost"
          size="icon"
          onClick={() => onNavigate("home")}
          className="h-9 w-9 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1
          className="font-display font-bold text-xl tracking-tight"
          style={{ color: "oklch(0.95 0.01 255)" }}
        >
          Recharge Account
        </h1>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Balance Card */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.22 0.03 255), oklch(0.19 0.022 255))",
              border: "1px solid oklch(0.3 0.03 255)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.65 0.18 145 / 0.2)" }}
              >
                <Wallet
                  className="h-5 w-5"
                  style={{ color: "oklch(0.72 0.18 145)" }}
                />
              </div>
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "oklch(0.55 0.04 255)" }}
                >
                  Current Balance
                </p>
                <p
                  className="font-display font-bold text-2xl"
                  style={{ color: "oklch(0.72 0.18 145)" }}
                >
                  ₹{balance}
                </p>
              </div>
            </div>
          </div>

          {/* Recharge package */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.38 0.1 150 / 0.3), oklch(0.28 0.06 180 / 0.2))",
              border: "1px solid oklch(0.5 0.12 150 / 0.5)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p
                  className="font-display font-bold text-3xl"
                  style={{ color: "oklch(0.95 0.01 255)" }}
                >
                  ₹100
                </p>
                <p
                  className="text-sm mt-0.5"
                  style={{ color: "oklch(0.6 0.06 180)" }}
                >
                  Standard recharge pack
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.18 145), oklch(0.55 0.16 160))",
                  boxShadow: "0 4px 12px oklch(0.65 0.18 145 / 0.4)",
                }}
              >
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {[
                "Unlimited chat sessions",
                "Send images & voice messages",
                "Access emoji & sticker library",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: "oklch(0.65 0.18 145)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "oklch(0.7 0.05 255)" }}
                  >
                    {feature}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs" style={{ color: "oklch(0.5 0.04 255)" }}>
              Amount:{" "}
              <strong style={{ color: "oklch(0.95 0.01 255)" }}>₹100</strong>
            </p>
          </div>

          <Button
            data-ocid="recharge.primary_button"
            onClick={() => onNavigate("payment")}
            className="w-full h-12 font-bold text-base btn-glow"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.65 0.18 145), oklch(0.55 0.16 160))",
              color: "white",
              border: "none",
              boxShadow: "0 4px 20px oklch(0.65 0.18 145 / 0.4)",
            }}
          >
            Pay Now — ₹100
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
