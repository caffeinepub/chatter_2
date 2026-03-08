import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addStoredBalance, getStoredSession } from "@/hooks/useChatterStore";
import { ArrowLeft, CreditCard, Loader2, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

type Screen = "auth" | "home" | "recharge" | "payment" | "finding" | "chat";

interface PaymentScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function PaymentScreen({ onNavigate }: PaymentScreenProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [paying, setPaying] = useState(false);

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1800));
    const session = getStoredSession();
    if (session?.username) {
      addStoredBalance(session.username, 100);
    }
    toast.success("Payment successful! ₹100 added to your account 🎉");
    setPaying(false);
    onNavigate("home");
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 30% 70%, oklch(0.35 0.08 280 / 0.2) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-6 pt-6 pb-4">
        <Button
          data-ocid="payment.cancel_button"
          variant="ghost"
          size="icon"
          onClick={() => onNavigate("recharge")}
          className="h-9 w-9 rounded-full"
          disabled={paying}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1
            className="font-display font-bold text-xl tracking-tight"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            Payment Gateway
          </h1>
          <p className="text-xs" style={{ color: "oklch(0.55 0.04 255)" }}>
            Secure mock payment
          </p>
        </div>
        <div
          className="flex items-center gap-1.5"
          style={{ color: "oklch(0.65 0.18 145)" }}
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Secured</span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Amount banner */}
          <div
            className="rounded-2xl p-4 mb-6 flex items-center justify-between"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.38 0.08 210 / 0.4), oklch(0.28 0.06 250 / 0.3))",
              border: "1px solid oklch(0.45 0.1 210 / 0.4)",
            }}
          >
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "oklch(0.55 0.05 255)" }}
              >
                Amount to Pay
              </p>
              <p
                className="font-display font-bold text-3xl mt-0.5"
                style={{ color: "oklch(0.95 0.01 255)" }}
              >
                ₹100
              </p>
            </div>
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
              }}
            >
              <CreditCard className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Card form */}
          <form onSubmit={handlePay} className="space-y-4">
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: "oklch(0.19 0.022 255 / 0.9)",
                border: "1px solid oklch(0.28 0.025 255)",
              }}
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="card-number"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Card Number
                </Label>
                <Input
                  id="card-number"
                  data-ocid="payment.input"
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(formatCardNumber(e.target.value))
                  }
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  required
                  disabled={paying}
                  className="bg-input/50 border-border/60 font-mono tracking-widest"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="expiry"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Expiry
                  </Label>
                  <Input
                    id="expiry"
                    data-ocid="payment.input"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    required
                    disabled={paying}
                    className="bg-input/50 border-border/60 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cvv"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    CVV
                  </Label>
                  <Input
                    id="cvv"
                    data-ocid="payment.input"
                    type="password"
                    value={cvv}
                    onChange={(e) =>
                      setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="•••"
                    maxLength={4}
                    required
                    disabled={paying}
                    className="bg-input/50 border-border/60 font-mono"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              data-ocid="payment.submit_button"
              disabled={paying}
              className="w-full h-12 font-bold text-base btn-glow"
              style={{
                background: paying
                  ? "oklch(0.3 0.04 255)"
                  : "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
                color: "white",
                border: "none",
                boxShadow: paying
                  ? "none"
                  : "0 4px 20px oklch(0.62 0.18 210 / 0.4)",
              }}
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Pay ₹100"
              )}
            </Button>
          </form>

          <p
            className="text-center text-xs mt-4"
            style={{ color: "oklch(0.45 0.03 255)" }}
          >
            This is a mock payment gateway. No real transaction occurs.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
