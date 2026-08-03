import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Expense Tracker — Personal Finance Dashboard" },
      {
        name: "description",
        content:
          "Track income, expenses, savings and category insights with a modern, offline-first FinTech dashboard.",
      },
      { property: "og:title", content: "Smart Expense Tracker" },
      {
        property: "og:description",
        content: "A modern FinTech dashboard to track income, expenses and monthly savings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The application itself is a standalone vanilla HTML/CSS/JS app served from
// /expense-tracker/index.html; this route embeds it full-screen at "/".
function Index() {
  return (
    <iframe
      src="/expense-tracker/index.html"
      title="Smart Expense Tracker"
      style={{ border: 0, width: "100%", height: "100vh", display: "block" }}
    />
  );
}
