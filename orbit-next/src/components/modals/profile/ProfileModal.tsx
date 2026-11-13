import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/data";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, authenticatedFetch } from "@/lib/api";
import { supabase } from "@/lib/config";
import { useToast } from "@/hooks/ui";
import { Settings, User as UserIcon, ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getPasswordChecks, isStrongPassword } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Removed accordion import - settings UI simplified and handled inline

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  startInSettings?: boolean;
}

const DEFAULT_PROFILE_IMAGE = "https://placehold.co/150x150/E0E0E0/FFFFFF/png?text=User"; // A generic user icon placeholder

export default function ProfileModal({ isOpen, onClose, startInSettings }: ProfileModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [profileImageUrlInput, setProfileImageUrlInput] = useState(user?.profileImageUrl || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.profileImageUrl || null);
  // removed emailNotifications state; settings simplified per user request
  const [showSettings, setShowSettings] = useState(!!startInSettings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // If startInSettings prop is true, open directly to settings tab on open
  useEffect(() => {
    if (isOpen && typeof startInSettings !== 'undefined') {
      setShowSettings(!!startInSettings);
    }
  }, [isOpen, startInSettings]);

  // ...existing code (all logic and return JSX below remains unchanged)...

  const passwordChecks = getPasswordChecks(newPassword);
  const passwordsMatch =
    newPassword.length > 0 &&
    confirmNewPassword.length > 0 &&
    newPassword === confirmNewPassword;
  const canResetPassword =
    currentPassword.length > 0 && isStrongPassword(newPassword) && passwordsMatch;

  const updateProfileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; profileImageUrl?: string }) => apiRequest("PUT", "/api/user/profile", data),
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated.",
      });
      // Close the modal after successful update
  onClose();
  // Ask the auth hook to refresh the user (useAuth listens for this event)
  try { window.dispatchEvent(new Event('orbit:auth:refresh')); } catch (e) {}
    },
    onError: (error: any) => {
      toast({
        title: "Profile Update Failed",
        description: error.message || "An error occurred while updating your profile.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { password: string; confirmPassword: string }) => {
      return authenticatedFetch("/auth/password/setup", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        await supabase.auth.signOut();
        toast({
          title: "Password Updated",
          description: "Your password was updated in Supabase. Please sign in again.",
        });
        window.location.href = "/login";
        return;
      }

      try { window.dispatchEvent(new Event("orbit:auth:refresh")); } catch (_) {}
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password Update Failed",
        description: error.message || "An error occurred while updating your password.",
        variant: "destructive",
      });
    },
  });

  // Removed updateUserSettingsMutation as it was only for theme/emailNotifications

  // Update logic uses the provided profile image URL

  const handleToggleSettings = () => setShowSettings(!showSettings);

  const handleResetPassword = async () => {
    if (!canResetPassword) {
      toast({
        title: "Password Requirements Not Met",
        description: "Enter your current password, use at least 8 characters, and make sure both new password fields match.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "Password Update Failed",
        description: "Your account email is missing. Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    const { error: currentPasswordError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (currentPasswordError) {
      toast({
        title: "Current Password Incorrect",
        description: "Enter your current password correctly before setting a new one.",
        variant: "destructive",
      });
      return;
    }

    await resetPasswordMutation.mutateAsync({
      password: newPassword,
      confirmPassword: confirmNewPassword,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full">
<VisuallyHidden asChild>
  <DialogTitle>User Profile Settings</DialogTitle>
</VisuallyHidden>

{!showSettings && (
  <DialogHeader>
    <DialogTitle className="flex items-center gap-2">
      <UserIcon className="h-5 w-5" />
      User Profile
    </DialogTitle>
    <DialogDescription>
      View your personal information.
    </DialogDescription>
  </DialogHeader>
)}

{showSettings && (
  <div className="flex items-center gap-2 mb-4">
    <button 
      onClick={onClose}
      className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
    <h2 className="text-lg font-semibold">User Settings</h2>
  </div>
)}
        <div className="flex-1 overflow-y-auto">
          {user ? (
            <>
              {!showSettings ? (
                <div className="flex flex-col items-center space-y-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <Avatar className="h-24 w-24 border-4 border-blue-200 shadow-lg">
                    <AvatarImage src={previewUrl || user.profileImageUrl || DEFAULT_PROFILE_IMAGE} alt="User Avatar" />
                    <AvatarFallback className="text-4xl bg-pink-500 text-white font-bold">
                      {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {/* Profile preview - uploads are available in User Settings only */}
                  <div className="text-center space-y-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-black-900">
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : (user.fullName || user.name || user.displayName || 'N/A')}
                    </h3>
                    <p className="text-sm sm:text-lg text-black-600">
                      {user.email || 'N/A'}
                    </p>
                  </div>
                  <div className="w-full space-y-3 pt-4 border-t border-gray-300">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-black-700">Role:</span>
                      <span className="text-pink-800 px-2 py-0.5 rounded-full font-medium">{user.role || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-black-700">Member Since:</span>
                      <span className="text-black-600">{new Date(user.createdAt).toLocaleDateString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 w-full mt-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex flex-col items-center space-y-4">
                      <Avatar className="h-24 w-24 border-4 border-blue-200 shadow-lg">
                        <AvatarImage src={previewUrl || user.profileImageUrl || DEFAULT_PROFILE_IMAGE} alt="User Avatar" />
                        <AvatarFallback className="text-4xl bg-pink-500 text-white font-bold">
                          {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col w-full space-y-2 pt-2">

            <div className=" text-sm font-semibold text-gray-900 truncate">
              <span className="font-semibold text-black-500 ">Name:</span>
              <span className="ml-2 text-black-800 font-medium">{user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.firstName || user.lastName || 'N/A'}
              </span>
            </div>

            <div className=" text-sm font-semibold text-gray-900 truncate">

            <span className="font-semibold text-black-500 ">Email:</span>
            {user.email && (
              <>
                <span className="ml-2 text-sm text-pink-700 break-all font-medium whitespace-normal" title={user.email}>{user.email}</span>
              </>
            )}</div>
                        <div className="flex items-center text-sm">
                          <span className="font-semibold text-black-500 ">Role:</span>
                          <span className="ml-2 text-pink-700 font-medium">{user.role || 'N/A'}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <span className="font-semibold text-black-500 ">Member Since:</span>
                          <span className="ml-2 text-pink-700 font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <label className="text-sm font-semibold text-black-700 border-t border-pink-600 pt-5">Profile Image URL</label>
                        <input
                          type="url"
                          value={profileImageUrlInput}
                          onChange={(e) => { setProfileImageUrlInput(e.target.value); setPreviewUrl(e.target.value || null); }}
                          placeholder="https://example.com/your-avatar.png"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        />
                        <p className="text-sm text-black-500">Paste a link to your avatar image above.</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-black-700 mb-2">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter your first name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-black-700 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter your last name"
                        />
                      </div>
                      {/* Removed direct Profile Image URL input to avoid duplication; upload via file input only */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={updateProfileMutation.isPending}
                            className="w-full px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Profile Update</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to save these changes to your profile?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                // Execute upload and update logic
                                const uploadAndUpdate = async () => {
                                  try {
                                        const finalUrl = profileImageUrlInput || undefined;
                                        await updateProfileMutation.mutateAsync({ firstName, lastName, profileImageUrl: finalUrl });
                                  } catch (err: any) {
                                    toast({ title: 'Upload Failed', description: err.message || 'Could not upload image', variant: 'destructive' });
                                  }
                                };
                                uploadAndUpdate();
                              }}
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter your current password"
                          autoComplete="current-password"
                          disabled={resetPasswordMutation.isPending}
                        />
                        <button
                          type="button"
                          aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Enter a new password"
                          autoComplete="new-password"
                          disabled={resetPasswordMutation.isPending}
                        />
                        <button
                          type="button"
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmNewPassword ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(event) => setConfirmNewPassword(event.target.value)}
                          className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Confirm your new password"
                          autoComplete="new-password"
                          disabled={resetPasswordMutation.isPending}
                        />
                        <button
                          type="button"
                          aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
                          onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                        >
                          {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg space-y-2">
                      <p className="text-[12px] font-medium text-gray-700">Password requirements</p>
                      <ChecklistItem ok={passwordChecks.hasMinLength} text="At least 8 characters" />
                      <ChecklistItem ok={passwordChecks.hasLowercase} text="At least one lowercase letter (a-z)" />
                      <ChecklistItem ok={passwordChecks.hasUppercase} text="At least one uppercase letter (A-Z)" />
                      <ChecklistItem ok={passwordChecks.hasNumber} text="At least one number (0-9)" />
                      <ChecklistItem ok={passwordChecks.hasSymbol} text="At least one symbol (!@#$%^&*)." />
                      <p className={`text-[12px] ${passwordsMatch ? "text-green-600" : "text-gray-500"}`}>
                        {passwordsMatch ? "Passwords match" : "Passwords must match"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={!canResetPassword || resetPasswordMutation.isPending}
                      className="w-full px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resetPasswordMutation.isPending ? "Updating Password..." : "Reset Password"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center space-y-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2 w-full">
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <Skeleton className="h-3 w-48 mx-auto" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-[12px] ${ok ? "text-green-600" : "text-gray-500"}`}>
      <Check className={`h-4 w-4 ${ok ? "text-green-600" : "text-gray-400"}`} />
      <span>{text}</span>
    </div>
  );
}