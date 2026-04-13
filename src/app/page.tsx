import { OrderForm } from "@/components/order-form";
import { AgentStats } from "@/components/agent-stats";

const CAPABILITIES = [
  { label: "Crypto", icon: "\u20bf", desc: "CoinGecko market data" },
  { label: "Stocks", icon: "\u2191", desc: "Alpha Vantage financials" },
  { label: "SEC Filings", icon: "\u2263", desc: "EDGAR public filings" },
  { label: "Companies", icon: "\u25cb", desc: "Apollo enrichment" },
  { label: "Web Search", icon: "\u2315", desc: "Exa + Brave + Perplexity" },
  { label: "Analysis", icon: "\u2734", desc: "Gemini synthesis" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Autonomous AI Agent &middot; Powered by Locus
          </span>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-16">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary-light">
              Autonomous Research Agent
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
              I research. I decide.
              <br />
              <span className="gradient-text">I deliver.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              I&apos;m an AI agent with my own wallet. Give me a research task, pay 3 USDC,
              and I&apos;ll autonomously decide which tools to use, execute the research,
              and deliver a comprehensive report.
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto">
              I earn revenue, manage my own API costs, and keep the profit.
              Every decision I make is logged and visible.
            </p>
          </div>

          {/* Agent Stats */}
          <div className="mb-12">
            <AgentStats />
          </div>

          {/* Capabilities */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.label}
                className="rounded-xl bg-card border border-border p-3 text-center"
              >
                <div className="text-xl mb-1 text-primary-light">{cap.icon}</div>
                <p className="text-sm font-medium">{cap.label}</p>
                <p className="text-xs text-muted-foreground">{cap.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-16">
            {[
              { step: "1", title: "Describe your task", desc: "Tell me what you need researched in plain text" },
              { step: "2", title: "Pay 3 USDC", desc: "Quick checkout via Locus on Base chain" },
              { step: "3", title: "Watch me work", desc: "See my decisions, API calls, and reasoning live" },
              { step: "4", title: "Get your report", desc: "Comprehensive analysis with data and sources" },
            ].map((s) => (
              <div key={s.step} className="rounded-xl bg-card border border-border p-5">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-sm font-bold mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Order Form */}
          <div className="max-w-lg mx-auto">
            <OrderForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 px-6 py-6 mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>Agent Zero &mdash; Locus Paygentic Hackathon</span>
          <span>Built with Locus Checkout + 9 Wrapped APIs</span>
        </div>
      </footer>
    </div>
  );
}
