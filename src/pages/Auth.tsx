import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TwoFactorVerify } from "@/components/TwoFactorVerify";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Car } from "lucide-react";
import { z } from "zod";
import { AuthenticatorAssuranceLevels } from "@supabase/supabase-js";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showMfaVerify, setShowMfaVerify] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check MFA status in a separate function to avoid async issues in callback
    const checkMfaStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
          // User has MFA enrolled but hasn't verified yet in this session
          setShowMfaVerify(true);
        } else if (aal?.currentLevel === "aal2") {
          // Already fully authenticated with MFA
          navigate("/deal-room");
        } else if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1") {
          // No MFA enrolled, proceed normally
          navigate("/deal-room");
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't use async here - defer to avoid deadlock
      if (session?.user) {
        // Use setTimeout to defer the async MFA check
        setTimeout(() => {
          checkMfaStatus();
        }, 0);
      }
    });

    // Initial check
    checkMfaStatus();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleMfaVerified = () => {
    setShowMfaVerify(false);
    navigate("/deal-room");
  };

  const handleMfaCancel = async () => {
    await supabase.auth.signOut();
    setShowMfaVerify(false);
    toast({
      title: "Sign Out",
      description: "You've been signed out.",
    });
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/deal-room`,
        },
      });
      if (error) {
        toast({
          title: "Google Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!email || !z.string().email().safeParse(email).success) {
      setErrors({ email: "Please enter a valid email" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account?reset=true`,
      });
      if (error) {
        toast({
          title: "Reset Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check Your Email",
          description: "We've sent you a password reset link.",
        });
        setIsForgotPassword(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast({
              title: "Login Failed",
              description: "Invalid email or password. Please try again.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login Failed",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        
        // Check if MFA is required immediately after login
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
          // User has MFA enrolled - show verification dialog
          setShowMfaVerify(true);
        } else {
          // No MFA or already verified - proceed to app
          toast({ title: "Welcome back!", description: "You have been logged in." });
          navigate("/deal-room");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/deal-room`,
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Try logging in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Signup Failed",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        toast({
          title: "Account Created!",
          description: "You can now log in to save and compare deals.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <SEO 
        title="Sign In"
        description="Sign in or create an account to save and compare car deals, track your DuoDrive scores, and book coaching sessions."
        canonical="/auth"
        noIndex
      />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isForgotPassword ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isForgotPassword
              ? "Enter your email to receive a reset link"
              : isLogin
              ? "Sign in to access your saved deals"
              : "Sign up to save and compare your car deals"}
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full mb-4"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isLogin ? "Signing in..." : "Creating account..."}
                    </>
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* MFA Verification Dialog */}
        <Dialog open={showMfaVerify} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Your account has 2FA enabled. Please verify to continue.
              </DialogDescription>
            </DialogHeader>
            <TwoFactorVerify 
              onVerified={handleMfaVerified}
              onCancel={handleMfaCancel}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}