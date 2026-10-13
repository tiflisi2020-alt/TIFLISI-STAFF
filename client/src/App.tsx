import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
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

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <StaffProvider>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/schedule" component={Schedule} />
                <Route path="/team" component={Team} />
                <Route path="/profile" component={Profile} />
                <Route path="/swap" component={Swap} />
                <Route path="/admin" component={Admin} />
                <Route path="/login" component={Login} />
                <Route path="/reset-password" component={Login} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </StaffProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
