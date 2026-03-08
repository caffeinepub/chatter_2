import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActor } from "@/hooks/useActor";
import { type Gender, useChatterStore } from "@/hooks/useChatterStore";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { Loader2, MessageCircleHeart } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AuthScreenProps {
  onSuccess: () => void;
}

type PendingAction = "register" | "login" | null;

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { setupProfile, login } = useChatterStore();
  const {
    identity,
    login: iiLogin,
    isInitializing,
    isLoggingIn,
    loginStatus,
  } = useInternetIdentity();
  const { actor } = useActor();

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regGender, setRegGender] = useState<Gender | "">("");
  const [regAge, setRegAge] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regOccupation, setRegOccupation] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Track if we're waiting for II to complete before proceeding
  const pendingActionRef = useRef<PendingAction>(null);
  const [waitingForII, setWaitingForII] = useState(false);

  // When II login completes (identity becomes available), proceed with the pending action
  useEffect(() => {
    if (!identity || !pendingActionRef.current || !waitingForII) return;

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setWaitingForII(false);

    if (action === "register") {
      performRegister();
    } else if (action === "login") {
      performLogin();
    }
    // performRegister/performLogin are stable refs — called after identity resolves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, waitingForII]);

  // Watch for II login errors while waiting
  useEffect(() => {
    if (!waitingForII) return;
    if (loginStatus === "loginError") {
      setWaitingForII(false);
      pendingActionRef.current = null;
      setRegLoading(false);
      setLoginLoading(false);
      setRegError("Secure session setup failed. Please try again.");
      setLoginError("Secure session setup failed. Please try again.");
    }
  }, [loginStatus, waitingForII]);

  const performRegister = useCallback(async () => {
    if (!regGender) {
      setRegError("Please select your gender.");
      setRegLoading(false);
      return;
    }
    const result = await setupProfile(
      regUsername,
      regGender as Gender,
      Number.parseInt(regAge, 10),
      regCity,
      regOccupation,
      regPassword,
    );
    setRegLoading(false);
    if (!result.ok) {
      setRegError(result.error ?? "Registration failed.");
      return;
    }
    toast.success("Account created! Welcome to TalkZy 💬");
    onSuccess();
  }, [
    regUsername,
    regPassword,
    regGender,
    regAge,
    regCity,
    regOccupation,
    setupProfile,
    onSuccess,
  ]);

  const performLogin = useCallback(async () => {
    const result = await login(loginUsername, loginPassword);
    setLoginLoading(false);
    if (!result.ok) {
      setLoginError(result.error ?? "Login failed.");
      return;
    }
    toast.success("Welcome back!");
    onSuccess();
  }, [loginUsername, loginPassword, login, onSuccess]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regGender) {
      setRegError("Please select your gender.");
      return;
    }
    if (!actor) {
      setRegError("Still connecting to network. Please wait a moment.");
      return;
    }

    setRegLoading(true);

    if (identity) {
      // Already have an identity — proceed directly
      await performRegister();
    } else {
      // Trigger II once; continue after identity resolves via useEffect
      pendingActionRef.current = "register";
      setWaitingForII(true);
      iiLogin();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!actor) {
      setLoginError("Still connecting to network. Please wait a moment.");
      return;
    }

    setLoginLoading(true);

    if (identity) {
      // Already have an identity — proceed directly
      await performLogin();
    } else {
      // Trigger II once; continue after identity resolves via useEffect
      pendingActionRef.current = "login";
      setWaitingForII(true);
      iiLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 20%, oklch(0.35 0.08 280 / 0.3) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, oklch(0.45 0.12 195 / 0.25) 0%, transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mb-4"
          >
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
          </motion.div>
          <h1
            className="text-3xl font-bold tracking-tight font-display"
            style={{ color: "oklch(0.95 0.01 255)" }}
          >
            TalkZy
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.6 0.04 255)" }}>
            Meet new people, have real conversations
          </p>
        </div>

        {/* Subtle status hint — only shown when waiting for II session or initializing */}
        {(isInitializing || waitingForII || isLoggingIn) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              style={{ color: "oklch(0.55 0.06 255)" }}
            />
            <span className="text-xs" style={{ color: "oklch(0.5 0.03 255)" }}>
              {waitingForII || isLoggingIn
                ? "Setting up secure session…"
                : "Initializing…"}
            </span>
          </motion.div>
        )}

        {/* Card */}
        <div
          className="rounded-2xl p-6 border"
          style={{
            background: "oklch(0.19 0.022 255 / 0.9)",
            backdropFilter: "blur(20px)",
            borderColor: "oklch(0.3 0.03 255)",
          }}
        >
          <Tabs defaultValue="create">
            <TabsList className="w-full mb-6 grid grid-cols-2">
              <TabsTrigger
                value="create"
                data-ocid="auth.tab"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Create Account
              </TabsTrigger>
              <TabsTrigger
                value="login"
                data-ocid="auth.tab"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Login
              </TabsTrigger>
            </TabsList>

            {/* ── Register Tab ── */}
            <TabsContent value="create">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label
                      htmlFor="reg-username"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Username
                    </Label>
                    <Input
                      id="reg-username"
                      data-ocid="auth.input"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="your_username"
                      autoComplete="username"
                      required
                      className="bg-input/50 border-border/60"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label
                      htmlFor="reg-password"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Password
                    </Label>
                    <Input
                      id="reg-password"
                      data-ocid="auth.input"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="bg-input/50 border-border/60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Gender
                    </Label>
                    <Select
                      value={regGender}
                      onValueChange={(v) => setRegGender(v as Gender)}
                    >
                      <SelectTrigger
                        data-ocid="auth.select"
                        className="bg-input/50 border-border/60"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="reg-age"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Age
                    </Label>
                    <Input
                      id="reg-age"
                      data-ocid="auth.input"
                      type="number"
                      min={18}
                      max={99}
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                      placeholder="25"
                      required
                      className="bg-input/50 border-border/60"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="reg-city"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      City
                    </Label>
                    <Input
                      id="reg-city"
                      data-ocid="auth.input"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="Mumbai"
                      required
                      className="bg-input/50 border-border/60"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label
                      htmlFor="reg-occupation"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Occupation
                    </Label>
                    <Input
                      id="reg-occupation"
                      data-ocid="auth.input"
                      value={regOccupation}
                      onChange={(e) => setRegOccupation(e.target.value)}
                      placeholder="Software Engineer"
                      required
                      className="bg-input/50 border-border/60"
                    />
                  </div>
                </div>

                {regError && (
                  <p
                    data-ocid="auth.error_state"
                    className="text-xs rounded-lg px-3 py-2"
                    style={{
                      background: "oklch(0.62 0.22 25 / 0.15)",
                      color: "oklch(0.75 0.18 25)",
                      border: "1px solid oklch(0.62 0.22 25 / 0.3)",
                    }}
                  >
                    {regError}
                  </p>
                )}

                <Button
                  type="submit"
                  data-ocid="auth.submit_button"
                  disabled={regLoading || waitingForII}
                  className="w-full btn-glow font-semibold"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
                    color: "white",
                    border: "none",
                  }}
                >
                  {(regLoading || waitingForII) &&
                  pendingActionRef.current === "register" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {waitingForII && pendingActionRef.current === "register"
                    ? "Setting up…"
                    : regLoading
                      ? "Creating account…"
                      : "Create Account"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Login Tab ── */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="login-username"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Username
                  </Label>
                  <Input
                    id="login-username"
                    data-ocid="auth.search_input"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="your_username"
                    autoComplete="username"
                    required
                    className="bg-input/50 border-border/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="login-password"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    data-ocid="auth.input"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="bg-input/50 border-border/60"
                  />
                </div>

                {loginError && (
                  <p
                    data-ocid="auth.error_state"
                    className="text-xs rounded-lg px-3 py-2"
                    style={{
                      background: "oklch(0.62 0.22 25 / 0.15)",
                      color: "oklch(0.75 0.18 25)",
                      border: "1px solid oklch(0.62 0.22 25 / 0.3)",
                    }}
                  >
                    {loginError}
                  </p>
                )}

                <Button
                  type="submit"
                  data-ocid="auth.submit_button"
                  disabled={loginLoading || waitingForII}
                  className="w-full btn-glow font-semibold"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.62 0.18 210), oklch(0.52 0.22 280))",
                    color: "white",
                    border: "none",
                  }}
                >
                  {(loginLoading || waitingForII) &&
                  pendingActionRef.current === "login" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {waitingForII && pendingActionRef.current === "login"
                    ? "Setting up…"
                    : loginLoading
                      ? "Logging in…"
                      : "Login"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: "oklch(0.5 0.03 255)" }}
        >
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "oklch(0.72 0.15 195)" }}
          >
            Built with caffeine.ai
          </a>
        </p>
      </motion.div>
    </div>
  );
}
