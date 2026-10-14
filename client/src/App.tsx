import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StaffProvider } from "./contexts/StaffContext";
import Layout from "./components/staff/Layout";
import NotFound from "./pages/NotFound";

const Home = lazy(() => import("./pages/Home"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Team = lazy(() => import("./pages/Team"));
const Profile = lazy(() => import("./pages/Profile"));
const Swap = lazy(() => import("./pages/Swap"));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <StaffProvider>
            <Layout>
              <Suspense
                fallback={
                  <div
                    className="loading-grid"
                    role="status"
                    aria-label="გვერდი იტვირთება"
                  >
                    <div className="loading-card" />
                  </div>
                }
              >
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
              </Suspense>
            </Layout>
          </StaffProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
