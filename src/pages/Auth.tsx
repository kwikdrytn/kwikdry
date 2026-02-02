import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import KwikDryLogo from "@/assets/KwikDryLogo.png";

type AuthMode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        
        if (error) {
          setError(error.message);
        } else {
          setResetEmailSent(true);
        }
      } else if (mode === "login") {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          navigate(from, { replace: true });
        }
      } else {
        if (!fullName.trim()) {
          setError("Please enter your full name");
          setIsLoading(false);
          return;
        }
        const result = await signUp(email, password, fullName);
        if (result.error) {
          setError(result.error);
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setResetEmailSent(false);
  };

  const getTitle = () => {
    if (mode === "forgot") return resetEmailSent ? "Check Your Email" : "Reset Password";
    return mode === "login" ? "Welcome back" : "Create an account";
  };

  const getDescription = () => {
    if (mode === "forgot") {
      return resetEmailSent 
        ? "We've sent you a password reset link" 
        : "Enter your email to receive a reset link";
    }
    return mode === "login" 
      ? "Enter your credentials to access your account" 
      : "Enter your details to get started";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src={KwikDryLogo} 
            alt="KwikDry" 
            className="h-20 w-auto"
          />
          <p className="text-muted-foreground">Dealership Management</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "forgot" && resetEmailSent ? (
              <div className="flex flex-col items-center space-y-4 py-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <p className="text-center text-muted-foreground">
                  Check your email at <span className="font-medium text-foreground">{email}</span> for a link to reset your password.
                </p>
                <Button
                  variant="outline"
                  onClick={() => switchMode("login")}
                  className="mt-4"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-sm text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-[#0f1729] hover:bg-[#1a2540] text-white font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === "forgot" ? "Sending..." : mode === "login" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : mode === "forgot" ? (
                    "Send Reset Link"
                  ) : mode === "login" ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            )}

            {!(mode === "forgot" && resetEmailSent) && (
              <div className="mt-6 text-center text-sm">
                {mode === "forgot" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-medium text-primary hover:underline inline-flex items-center"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to Sign In
                  </button>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                    </span>{" "}
                    <button
                      type="button"
                      onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                      className="font-medium text-primary hover:underline"
                      disabled={isLoading}
                    >
                      {mode === "login" ? "Sign up" : "Sign in"}
                    </button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}