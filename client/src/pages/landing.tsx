import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Users, Shield } from "lucide-react";

import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Brand Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand-2 rounded-2xl flex items-center justify-center font-bold text-2xl text-primary-foreground shadow-2xl">
              CM
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Construction Monitor
            <span className="block text-brand">Uganda</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Professional project management system for construction companies. 
            Track budgets, manage tasks, monitor suppliers, and ensure daily accountability.
          </p>

          {/* CTA Button */}
          <Button 
            onClick={handleLogin}
            className="btn-brand text-lg px-8 py-6 rounded-xl mb-12"
          >
            Get Started
          </Button>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <Card className="card-glass">
              <CardHeader className="pb-4">
                <Building2 className="w-8 h-8 text-brand mb-2" />
                <CardTitle className="text-white text-lg">Project Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Track multiple construction projects with budget monitoring and progress tracking.
                </p>
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-4">
                <TrendingUp className="w-8 h-8 text-brand mb-2" />
                <CardTitle className="text-white text-lg">Financial Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Monitor expenses, manage cash flow, and track supplier credits with detailed analytics.
                </p>
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-4">
                <Users className="w-8 h-8 text-brand mb-2" />
                <CardTitle className="text-white text-lg">Team Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Role-based access for owners and managers with real-time updates and photo sharing.
                </p>
              </CardContent>
            </Card>

            <Card className="card-glass">
              <CardHeader className="pb-4">
                <Shield className="w-8 h-8 text-brand mb-2" />
                <CardTitle className="text-white text-lg">Daily Accountability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Daily ledger system ensures transparent financial tracking and accountability.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center px-4">
          <p className="text-muted-foreground">
            Construction Monitor Uganda - Professional project management for construction companies
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Features: Money management • Supplier credit • Inventory • Milestones • Daily Accountability
          </p>
        </div>
      </footer>
    </div>
  );
}
