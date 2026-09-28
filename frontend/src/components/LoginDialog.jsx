import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { LogIn } from "lucide-react";
import * as api from "../lib/api";
import { toast } from "sonner";

export const LoginDialog = ({ open, onOpenChange, onLoggedIn }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setUsername(""); setPassword(""); setError(""); setLoading(false); };
  const handleOpenChange = (o) => { if (!o) reset(); onOpenChange(o); };

  const submit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError("");
    try {
      const data = await api.login(username.trim(), password);
      onLoggedIn(data);
      toast.success(`Logged in as ${data.username}`);
      handleOpenChange(false);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]" data-testid="login-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">Sign in</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Authorized users can approve purchase records.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="login-username">Username</Label>
            <Input id="login-username" data-testid="login-username" value={username} autoFocus
              onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" data-testid="login-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="cancel-login-btn">Cancel</Button>
            <Button type="submit" disabled={loading || !username || !password} data-testid="submit-login-btn"
              className="bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 active:scale-95 transition-transform">
              <LogIn className="h-4 w-4 mr-2" /> {loading ? "Signing in..." : "Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
