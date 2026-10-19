import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-[calc(100%-2rem)] max-w-lg shadow-lg border-border bg-card">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-secondary rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-primary" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>

          <h2 className="text-xl font-semibold text-foreground mb-4">
            გვერდი ვერ მოიძებნა
          </h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            გვერდი, რომელსაც ეძებ, არ არსებობს.
            <br />
            შესაძლოა ბმული შეიცვალა ან წაიშალა.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-primary hover:opacity-90 text-primary-foreground px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              მთავარზე დაბრუნება
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
