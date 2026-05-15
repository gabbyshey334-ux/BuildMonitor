import { Link } from "wouter";
import { Wrench, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Wrench className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Under maintenance</h1>
          <p className="text-sm text-muted-foreground">
            JengaTrack is temporarily unavailable while we deploy updates. Please check back shortly.
          </p>
          <Link href="/">
            <Button className="mt-2">
              <Home className="h-4 w-4 mr-2" />
              Back to home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
