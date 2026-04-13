import { OrderForm } from "@/components/order-form";
import { AgentStats } from "@/components/agent-stats";

const CAPABILITIES = [
  { label: "Crypto", icon: "\u20bf", desc: "CoinGecko markets", color: "text-amber-400" },
  { label: "Stocks", icon: "\u2191", desc: "Alpha Vantage", color: "text-green-400" },
  { label: "SEC Filings", icon: "\u2263", desc: "EDGAR data", color: "text-blue-400" },
  { label: "Companies", icon: "\u25cb", desc: "Apollo intel", color: "text-purple-400" },
  { label: "Web Search", icon: "\u2315", desc: "Exa + Brave", color: "text-cyan-400" },
  { label: "Multi-Round", icon: "\u21bb", desc: "Iterative deep", color: "text-orange-400" },
  { label: "Agent API", icon: "\u26a1", desc: "Agent-to-agent", color: "text-yellow-400" },
  { label: "Synthesis", icon: "\u2734", desc: "Gemini AI", color: "text-pink-400" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 noise-bg">
      {/* Header */}
      <header className="border-b border-border/30 px-6 py-4 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="status-dot" />
            <span className="text-xl font-bold tracking-tight font-mono">
              AGENT<span className="gradient-text">ZERO</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="data-readout text-muted-foreground hidden sm:block">
              Autonomous Research Agent
            </span>
            <span className="data-readout text-accent/60">
              POWERED BY LOCUS
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero with grid pattern */}
        <section className="hero-bg grid-pattern">
          <div className="max-w-6xl mx-auto px-6 pt-20 pb-16">
            {/* Hero */}
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-accent/20 bg-accent/5">
                <div className="status-dot" />
                <span className="data-readout text-accent">
                  System Online &mdash; Ready for Tasks
                </span>
              </div>

              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 leading-[1.1]" style={{ fontFamily: "'Sora', sans-serif" }}>
                I research. I decide.
                <br />
                <span className="gradient-text">I deliver.</span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-3 leading-relaxed">
                An autonomous AI agent with its own wallet and research council.
                Three specialist agents research independently, debate findings,
                and deliver reports using 9 premium data sources.
              </p>
              <p className="text-sm text-muted-foreground/50 max-w-xl mx-auto font-mono">
                // earns revenue &middot; manages costs &middot; keeps profit &middot; logs every decision
              </p>
            </div>

            {/* Agent Stats */}
            <div className="mb-14">
              <AgentStats />
            </div>

            {/* Capabilities */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-14">
              {CAPABILITIES.map((cap, i) => (
                <div
                  key={cap.label}
                  className="glow-card p-3 text-center animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`text-xl mb-1 ${cap.color}`}>{cap.icon}</div>
                  <p className="text-sm font-semibold">{cap.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{cap.desc}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-16">
              {[
                { step: "01", title: "Describe your task", desc: "Free-text research request", icon: "\u270e" },
                { step: "02", title: "Choose depth", desc: "Quick \u00b7 Standard \u00b7 Deep Dive", icon: "\u2261" },
                { step: "03", title: "Watch agents work", desc: "Live decision log + debates", icon: "\u25b6" },
                { step: "04", title: "Get your report", desc: "Multi-source analysis", icon: "\u2713" },
              ].map((s, i) => (
                <div
                  key={s.step}
                  className="glow-card p-5 animate-fade-up"
                  style={{ animationDelay: `${400 + i * 80}ms` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{s.icon}</span>
                    <span className="data-readout text-primary-light">STEP {s.step}</span>
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
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 px-6 py-5 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="data-readout text-muted-foreground">
            Agent Zero &mdash; Locus Paygentic Hackathon
          </span>
          <span className="data-readout text-muted-foreground/50">
            9 APIs &middot; 3 Specialists &middot; Multi-Round Research
          </span>
        </div>
      </footer>
    </div>
  );
}
