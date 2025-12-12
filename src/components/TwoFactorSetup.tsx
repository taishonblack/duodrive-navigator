import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Copy, Check, AlertCircle } from "lucide-react";

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<"loading" | "qr" | "verify" | "error">("loading");
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { toast } = useToast();

  // Start enrollment on mount
  useEffect(() => {
    enrollFactor();
  }, []);

  const enrollFactor = async () => {
    setStep("loading");
    setErrorMessage("");
    
    try {
      // First check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setErrorMessage("You must be logged in to enable 2FA.");
        setStep("error");
        return;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "DuoDrive Authenticator",
      });

      if (error) {
        console.error("MFA enroll error:", error);
        setErrorMessage(error.message || "Failed to start 2FA setup. Please try again.");
        setStep("error");
        toast({
          title: "Setup Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data && data.totp) {
        setQrUri(data.totp.uri);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep("qr");
      } else {
        setErrorMessage("Invalid response from authentication server.");
        setStep("error");
      }
    } catch (error) {
      console.error("MFA setup error:", error);
      const message = error instanceof Error ? error.message : "Failed to start 2FA setup";
      setErrorMessage(message);
      setStep("error");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the secret manually",
        variant: "destructive",
      });
    }
  };

  const verifyAndEnable = async () => {
    if (verifyCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast({
          title: "Verification Failed",
          description: challengeError.message,
          variant: "destructive",
        });
        return;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) {
        toast({
          title: "Invalid Code",
          description: "The code you entered is incorrect. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication is now active on your account.",
      });
      onComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Setting up 2FA...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Setup Failed</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {errorMessage || "An error occurred while setting up 2FA."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={enrollFactor}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === "qr" && (
        <>
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Scan QR Code</h3>
            <p className="text-sm text-muted-foreground">
              Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code
            </p>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-lg">
            <QRCodeSVG value={qrUri} size={200} level="M" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Can't scan? Enter this code manually:
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                {secret}
              </code>
              <Button variant="outline" size="sm" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setStep("verify")}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === "verify" && (
        <>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Verify Setup</h3>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to complete setup
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verifyCode">Verification Code</Label>
            <Input
              id="verifyCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-widest"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep("qr")} disabled={isLoading}>
              Back
            </Button>
            <Button className="flex-1" onClick={verifyAndEnable} disabled={isLoading || verifyCode.length !== 6}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Enable 2FA"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}