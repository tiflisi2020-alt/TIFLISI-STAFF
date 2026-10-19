import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StaffProvider } from "./contexts/StaffContext";
import Layout from "./components/staff/Layout";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Swap from "./pages/Swap";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Login from "./pages/Login";

function RoutePersistence() {
  const [location, navigate] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const previousRoute = sessionStorage.getItem("tiflisi-last-route");
      if (
        !initialized.current &&
        navigation?.type === "reload" &&
        location === "/" &&
        previousRoute &&
        previousRoute !== "/"
      ) {
        initialized.current = true;
        navigate(previousRoute, { replace: true });
        return;
      }
      initialized.current = true;
      sessionStorage.setItem("tiflisi-last-route", location);
    } catch {
      // Private browsing can block sessionStorage; normal routing still works.
    }
  }, [location, navigate]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <StaffProvider>
            <RoutePersistence />
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/reset-password" component={Login} />
              <Route>
                <Layout>
                  <Switch>
                    <Route path="/" component={Home} />
                    <Route path="/schedule" component={Schedule} />
                    <Route path="/team" component={Team} />
                    <Route path="/profile" component={Profile} />
                    <Route path="/swap" component={Swap} />
                    <Route path="/admin" component={Admin} />
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
              </Route>
            </Switch>
          </StaffProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
