import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TabProtectionProps {
  onVerified: () => void;
  tabName: string;
}

export default function TabProtection({ onVerified, tabName }: TabProtectionProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username: user?.username, 
          password 
        }),
      });

      const data = await response.json();

      if (data.success) {
        onVerified();
        toast({
          title: "Access granted",
          description: "You now have access to all protected sections",
        });
      } else {
        toast({
          title: "Access denied",
          description: "Incorrect password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Verification failed",
        description: "An error occurred during verification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="card-glass w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white text-center">
            Access {tabName}
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Please verify your password once to access all protected sections
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-password" className="text-white">
                Password for {user?.username} ({user?.role})
              </Label>
              <Input
                id="verify-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                data-testid="input-verify-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-brand min-h-[44px]"
              disabled={isLoading}
              data-testid="button-verify-access"
            >
              {isLoading ? "Verifying..." : "Unlock All Sections"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}