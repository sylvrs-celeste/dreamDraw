import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";
import AdminIndex from "./routes/admin/Index";
import EntryForm from "./routes/admin/EntryForm";
import Login from "./routes/admin/Login";
import EntryDetail from "./routes/EntryDetail";
import Gallery from "./routes/Gallery";
import Home from "./routes/Home";
import NotFound from "./routes/NotFound";
import RouteError from "./routes/RouteError";
import Timeline from "./routes/Timeline";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Image urls are presigned for an hour. Holding a response longer than
      // that hands the browser links S3 has stopped honouring, so images
      // silently break on a tab left open. 30 minutes leaves plenty of margin.
      staleTime: 30 * 60 * 1000,
      gcTime: 45 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: "gallery", element: <Gallery /> },
      { path: "timeline", element: <Timeline /> },
      { path: "e/:slug", element: <EntryDetail /> },
      { path: "admin/login", element: <Login /> },
      {
        path: "admin",
        element: (
          <RequireAuth>
            <AdminIndex />
          </RequireAuth>
        ),
      },
      {
        path: "admin/new",
        element: (
          <RequireAuth>
            <EntryForm />
          </RequireAuth>
        ),
      },
      {
        path: "admin/e/:slug",
        element: (
          <RequireAuth>
            <EntryForm />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
