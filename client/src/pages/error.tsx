import { Link } from "wouter";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorPageProps = {
  code?: number;
  title?: string;
  message?: string;
  showRetry?: boolean;
};

export default function ErrorPage({
  code = 500,
  title = "Something went wrong",
  message = "We hit an unexpected error. Please try again in a moment.",
  showRetry = true,
}: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-sm font-mono text-muted-foreground">{code}</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {showRetry && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            )}
            <Link href="/">
              <Button>
                <Home className="h-4 w-4 mr-2" />
                Go home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
