import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(username, password);
      // Navigation happens automatically in the AuthProvider after successful login
    } catch (error) {
      // Error handling happens in AuthProvider with toast notification
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="w-full max-w-md space-y-8 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Construction Monitor Uganda
          </h1>
          <p className="text-muted-foreground">
            Sign in to access your project dashboard
          </p>
        </div>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white text-center">
              Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  data-testid="input-username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-brand min-h-[44px]"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                Demo Credentials:
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-300 mb-1">Project Owner</div>
                  <div className="text-xs text-blue-200">
                    Username: <span className="font-mono">owner</span><br />
                    Password: <span className="font-mono">owner123</span>
                  </div>
                </div>
                
                <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-300 mb-1">Site Manager</div>
                  <div className="text-xs text-green-200">
                    Username: <span className="font-mono">manager</span><br />
                    Password: <span className="font-mono">manager123</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}