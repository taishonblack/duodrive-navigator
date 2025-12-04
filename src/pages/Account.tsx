import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Shield, LogOut, ShieldCheck, ShieldOff, Camera, Trash2, Bell, Car, BarChart3, GraduationCap, Newspaper, AlertTriangle } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

interface NotificationPreferences {
  deal_reminders: boolean;
  score_updates: boolean;
  coaching_offers: boolean;
  product_news: boolean;
}

const defaultPreferences: NotificationPreferences = {
  deal_reminders: true,
  score_updates: true,
  coaching_offers: true,
  product_news: false,
};

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
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
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

  const loadNotificationPreferences = async (userId: string) => {
    setIsNotifLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("deal_reminders, score_updates, coaching_offers, product_news")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading notification preferences:", error);
        return;
      }

      if (data) {
        setNotifPrefs({
          deal_reminders: data.deal_reminders,
          score_updates: data.score_updates,
          coaching_offers: data.coaching_offers,
          product_news: data.product_news,
        });
      } else {
        // Create default preferences if they don't exist
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: userId });
        
        if (insertError) {
          console.error("Error creating notification preferences:", insertError);
        }
      }
    } catch (error) {
      console.error("Error loading notification preferences:", error);
    } finally {
      setIsNotifLoading(false);
    }
  };

  const updateNotificationPreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    const previousValue = notifPrefs[key];
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    setIsSavingNotif(true);

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) {
        // Revert on error
        setNotifPrefs(prev => ({ ...prev, [key]: previousValue }));
        toast({
          title: "Update Failed",
          description: "Could not save your preference. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setNotifPrefs(prev => ({ ...prev, [key]: previousValue }));
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotif(false);
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
        loadNotificationPreferences(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isReset]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

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

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBuster })
        .eq("id", user.id);

      if (updateError) throw updateError;

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
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(user.id);

      if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || !deletePassword) return;
    setDeleteError("");

    setIsDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to delete your account.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("delete-account", {
        body: { password: deletePassword },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        if (response.data.error === "Incorrect password") {
          setDeleteError("Incorrect password. Please try again.");
          return;
        }
        throw new Error(response.data.error);
      }

      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted.",
      });

      navigate("/");
    } catch (error) {
      console.error("Delete account error:", error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
      setDeleteConfirmText("");
      setDeletePassword("");
    }
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

  const notificationOptions = [
    {
      key: "deal_reminders" as const,
      icon: Car,
      title: "Deal Reminders",
      description: "Get reminded about deals you've saved but haven't completed",
    },
    {
      key: "score_updates" as const,
      icon: BarChart3,
      title: "Score Updates",
      description: "Receive updates when market conditions affect your saved deals",
    },
    {
      key: "coaching_offers" as const,
      icon: GraduationCap,
      title: "Coaching Offers",
      description: "Special offers and tips from our car buying coaches",
    },
    {
      key: "product_news" as const,
      icon: Newspaper,
      title: "Product News",
      description: "New features and updates from DuoDrive",
    },
  ];

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

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Choose which emails you'd like to receive
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isNotifLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preferences...
                </div>
              ) : (
                <div className="space-y-4">
                  {notificationOptions.map((option) => (
                    <div
                      key={option.key}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <option.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{option.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={notifPrefs[option.key]}
                        onCheckedChange={(checked) => updateNotificationPreference(option.key, checked)}
                        disabled={isSavingNotif}
                      />
                    </div>
                  ))}
                </div>
              )}
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

          {/* Delete Account */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete Account Permanently?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        This action cannot be undone. This will permanently delete:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Your profile and account information</li>
                        <li>All saved deals and score results</li>
                        <li>Notification preferences</li>
                        <li>Profile photos and uploads</li>
                      </ul>
                      <div className="pt-2 space-y-3">
                        <div>
                          <Label htmlFor="deletePassword" className="text-foreground font-medium">
                            Enter your password to confirm:
                          </Label>
                          <Input
                            id="deletePassword"
                            type="password"
                            value={deletePassword}
                            onChange={(e) => {
                              setDeletePassword(e.target.value);
                              setDeleteError("");
                            }}
                            placeholder="Your password"
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label className="text-foreground font-medium">
                            Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                          </Label>
                          <Input
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            className="mt-2"
                          />
                        </div>
                        {deleteError && (
                          <p className="text-sm text-destructive">{deleteError}</p>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setDeleteConfirmText("");
                      setDeletePassword("");
                      setDeleteError("");
                    }}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE" || !deletePassword || isDeletingAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingAccount ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Account"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-muted-foreground mt-3">
                Once deleted, your data cannot be recovered.
              </p>
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