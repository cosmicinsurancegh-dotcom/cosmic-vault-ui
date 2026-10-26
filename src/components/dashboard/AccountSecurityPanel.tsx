import { Callout, Detail, Panel, PanelHeader } from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, KeyRound, Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * The account behind the dashboard: the address it signs in with, the password,
 * and deleting it.
 *
 * Shared by every dashboard - member, broker and staff - because the rules are
 * the same for all of them. The one difference is deletion: a super admin can
 * never delete its own account, so the control explains that instead of
 * offering an action the server would refuse.
 */
export function AccountSecurityPanel({
  email,
  roleLabel,
  canDelete,
  deleteBlockedReason,
}: {
  email: string;
  roleLabel: string;
  canDelete: boolean;
  deleteBlockedReason?: string;
}) {
  const passwordStatus = useQuery(api.accountSecurity.passwordStatus);
  const savePassword = useAction(api.accountSecurity.setPassword);
  const changeEmail = useMutation(api.accountSecurity.changeEmail);
  const closeAccount = useMutation(api.accountSecurity.closeAccount);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [emailOpen, setEmailOpen] = useState(false);
  const [nextEmail, setNextEmail] = useState(email);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const hasPassword = passwordStatus?.hasPassword ?? false;

  const handleEmail = async () => {
    setEmailSaving(true);
    try {
      const result = await changeEmail({ email: nextEmail });
      toast.success("Sign-in email updated.", {
        description: `Your next sign-in code goes to ${result.email}.`,
      });
      setEmailOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the email.",
      );
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePassword = async () => {
    if (passwordForm.next.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error("Those passwords don't match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await savePassword({ password: passwordForm.next });
      toast.success("Password saved.", {
        description:
          "You can now sign in with your email and password, or keep using an email code.",
      });
      setPasswordOpen(false);
      setPasswordForm({ next: "", confirm: "" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the password.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await closeAccount({ reason: deleteReason.trim() || undefined });
      setDeleteOpen(false);
      toast.success("Your account has been deleted.", {
        description:
          "Your personal details and sign-in were removed. Policies and payment records are kept for the legal period.",
      });
      await signOut();
      navigate("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the account.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Account & sign-in" />
      <div className="space-y-3 px-5 py-4">
        <Detail label="Email">{email || "Not set"}</Detail>
        <Detail label="Password">
          {passwordStatus === undefined
            ? "Checking…"
            : hasPassword
              ? "Set - sign in with it, or with an email code"
              : "Not set - add one to sign in without waiting for a code"}
        </Detail>
        <Detail label="Role">{roleLabel}</Detail>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            className="rounded-[4px] bg-transparent"
            onClick={() => {
              setNextEmail(email);
              setEmailOpen(true);
            }}
          >
            <Mail className="size-4" />
            Change email
          </Button>
          <Button
            variant="outline"
            className="rounded-[4px] bg-transparent"
            onClick={() => setPasswordOpen(true)}
          >
            <KeyRound className="size-4" />
            {hasPassword ? "Change password" : "Set a password"}
          </Button>
        </div>

        <Callout tone="info">
          A password is optional: your email code always works. Use at least 8
          characters, and never share a one-time code with anyone.
        </Callout>

        <div className="border-t border-line pt-3">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Delete account
          </p>
          {canDelete ? (
            <>
              <p className="mt-1 text-[0.62rem] leading-5 text-muted-foreground">
                Removes your sign-in and personal details immediately. Policies,
                claims and payments stay on record, without your personal
                details, for the period the law requires.
              </p>
              <Button
                variant="outline"
                className="mt-2 rounded-[4px] border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setDeleteReason("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                Delete my account
              </Button>
            </>
          ) : (
            <p className="mt-1 text-[0.62rem] leading-5 text-muted-foreground">
              {deleteBlockedReason ??
                "Super admin accounts cannot be deleted."}
            </p>
          )}
        </div>
      </div>

      <Dialog
        open={emailOpen}
        onOpenChange={(open) => {
          setEmailOpen(open);
          if (!open) setNextEmail(email);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Change your sign-in email</DialogTitle>
            <DialogDescription>
              This is the address your sign-in codes are sent to, and the one
              receipts and updates use. Nothing else on your account moves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">New email address</Label>
            <Input
              id="account-email"
              type="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              className="h-11 rounded-xl bg-card"
              autoComplete="email"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[4px]"
              onClick={() => setEmailOpen(false)}
              disabled={emailSaving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[4px]"
              onClick={handleEmail}
              disabled={
                emailSaving ||
                !nextEmail.trim() ||
                nextEmail.trim().toLowerCase() === email.toLowerCase()
              }
            >
              {emailSaving && <Loader2 className="size-4 animate-spin" />}
              Save email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open);
          if (!open) setPasswordForm({ next: "", confirm: "" });
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {hasPassword ? "Change your password" : "Set a password"}
            </DialogTitle>
            <DialogDescription>
              Your email code keeps working either way. Use at least 8
              characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.next}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, next: event.target.value })
                }
                placeholder="At least 8 characters"
                className="h-11 rounded-xl bg-card"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirm: event.target.value,
                  })
                }
                placeholder="Repeat your password"
                className="h-11 rounded-xl bg-card"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-[4px]"
              onClick={() => setPasswordOpen(false)}
              disabled={passwordSaving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[4px]"
              onClick={handlePassword}
              disabled={
                passwordSaving ||
                passwordForm.next.length < 8 ||
                passwordForm.next !== passwordForm.confirm
              }
            >
              {passwordSaving && <Loader2 className="size-4 animate-spin" />}
              Save password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              {email ? `${email} loses access immediately. ` : ""}
              Your personal details are removed and this cannot be undone.
              Policies, claims and payment records are kept without your
              personal details for the legal retention period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-reason">
              Anything you want us to know? (optional)
            </Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="For example, closing this policy and moving insurer."
              className="min-h-[70px] rounded-xl bg-card"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]">
              Keep my account
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[4px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
