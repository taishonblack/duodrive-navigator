import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Shield, LogOut, ShieldCheck, ShieldOff, Camera, Trash2 } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

export default function Account() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReset = searchParams.get("reset") === "true";

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadMfaFactors = async () => {
    setIsMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error("Failed to load MFA factors:", error);
        return;
      }
      const verifiedFactors = data.totp.filter(f => f.status === "verified");
      setMfaFactors(verifiedFactors);
    } catch (error) {
      console.error("Error loading MFA factors:", error);
    } finally {
      setIsMfaLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session?.user && !isReset) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session?.user && !isReset) {
        navigate("/auth");
      } else if (session?.user) {
        loadMfaFactors();
        loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isReset]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache buster to URL
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBuster })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(urlWithCacheBuster);
      toast({
        title: "Avatar Updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setIsUploadingAvatar(true);
    try {
      // List files in user's folder
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(user.id);

      // Delete all avatar files
      if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }

      // Update profile
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      setAvatarUrl(null);
      toast({
        title: "Avatar Removed",
        description: "Your profile photo has been removed.",
      });
    } catch (error) {
      console.error("Avatar removal error:", error);
      toast({
        title: "Error",
        description: "Failed to remove avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        toast({
          title: "Password Update Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been changed successfully.",
        });
        setNewPassword("");
        setConfirmPassword("");
        
        if (isReset) {
          navigate("/deal-room");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleDisableMfa = async (factorId: string) => {
    setIsMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) {
        toast({
          title: "Failed to Disable 2FA",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "2FA Disabled",
          description: "Two-factor authentication has been removed from your account.",
        });
        loadMfaFactors();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleMfaSetupComplete = () => {
    setShowMfaSetup(false);
    loadMfaFactors();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const hasMfaEnabled = mfaFactors.length > 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account preferences and security
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information and photo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl || undefined} alt="Profile photo" />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                      {getInitials(user?.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {avatarUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {isReset ? "Set New Password" : "Change Password"}
              </CardTitle>
              <CardDescription>
                {isReset 
                  ? "Create a new password for your account"
                  : "Update your password to keep your account secure"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isPasswordLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isPasswordLoading}
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
                <Button type="submit" disabled={isPasswordLoading}>
                  {isPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 2FA Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Two-Factor Authentication
                {hasMfaEnabled && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full ml-2">
                    <ShieldCheck className="h-3 w-3" />
                    Enabled
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {hasMfaEnabled 
                  ? "Your account is protected with authenticator app verification"
                  : "Add an extra layer of security with authenticator app verification"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isMfaLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : hasMfaEnabled ? (
                <div className="space-y-4">
                  {mfaFactors.map((factor) => (
                    <div key={factor.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">Authenticator App</p>
                          <p className="text-sm text-muted-foreground">
                            {factor.friendly_name || "TOTP Authenticator"}
                          </p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Disable
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the extra security layer from your account. You can always enable it again later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDisableMfa(factor.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Disable 2FA
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              ) : (
                <Button onClick={() => setShowMfaSetup(true)}>
                  <Shield className="h-4 w-4 mr-2" />
                  Enable 2FA
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card>
            <CardContent className="pt-6">
              <Button variant="destructive" onClick={handleSignOut} className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 2FA Setup Dialog */}
        <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Secure your account with an authenticator app
              </DialogDescription>
            </DialogHeader>
            <TwoFactorSetup 
              onComplete={handleMfaSetupComplete}
              onCancel={() => setShowMfaSetup(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}