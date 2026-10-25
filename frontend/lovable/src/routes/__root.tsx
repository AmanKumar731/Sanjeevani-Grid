import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This signal didn't reach the grid.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-arctic px-4 py-2 text-sm font-medium text-white"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Signal lost</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-arctic px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sanjeevani Grid — Real-Time Emergency Medical Command (Delhi NCR)" },
      {
        name: "description",
        content: "Sanjeevani Grid orchestrates ambulances, triage and Delhi hospital capacity in real time.",
      },
      { property: "og:title", content: "Sanjeevani Grid — Real-Time Emergency Medical Command (Delhi NCR)" },
      {
        property: "og:description",
        content: "Sanjeevani Grid orchestrates ambulances, triage and Delhi hospital capacity in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Sanjeevani Grid — Real-Time Emergency Medical Command (Delhi NCR)" },
      {
        name: "twitter:description",
        content: "Sanjeevani Grid orchestrates ambulances, triage and Delhi hospital capacity in real time.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/e0882225-1861-4f94-84d1-ce8261737c9a",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/e0882225-1861-4f94-84d1-ce8261737c9a",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { Toaster } from "@/components/ui/sonner";
import { AuraAssistant } from "@/components/AuraAssistant";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <Outlet />
        <Footer />
        <Toaster position="top-right" richColors />
        <AuraAssistant />
      </div>
    </QueryClientProvider>
  );
}
