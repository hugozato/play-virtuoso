import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Coins, Gift, Trophy, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Luxe Casino — Cassino Social com Moedas Virtuais" },
      { name: "description", content: "Slots, blackjack e mais. 500 moedas grátis ao se cadastrar. Sem dinheiro real." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LUXE CASINO
          </span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
          <Button asChild className="bg-gradient-to-r from-primary to-accent border-0">
            <Link to="/login">Começar grátis</Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto px-4 pt-12 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold uppercase tracking-wider mb-6">
          <Zap className="h-3.5 w-3.5" /> 100% diversão · 0% dinheiro real
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-[1.05]">
          O cassino social mais{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            viciante
          </span>{" "}
          da internet.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Ganhe <strong className="text-foreground">500 moedas grátis</strong> ao se cadastrar.
          Jogue slots, blackjack e suba de plano para desbloquear bônus diários massivos.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent border-0 shadow-[var(--shadow-glow)] text-base h-12 px-8">
            <Link to="/login">Jogar agora — é grátis</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base h-12 px-8">
            <a href="#planos">Ver planos</a>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Coins, title: "Moedas virtuais", desc: "Sem apostas com dinheiro real. Só diversão pura." },
          { icon: Gift, title: "Bônus diário", desc: "Volte todo dia e ganhe moedas grátis no seu plano." },
          { icon: Trophy, title: "Torneios VIP", desc: "Planos Ouro disputam torneios exclusivos." },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-2xl bg-card/60 border border-border backdrop-blur-sm hover:border-primary/50 transition">
            <f.icon className="h-8 w-8 text-accent mb-3" />
            <h3 className="font-bold text-lg">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      <section id="planos" className="container mx-auto px-4 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black">Escolha seu plano</h2>
          <p className="text-muted-foreground mt-3">Quanto maior o plano, maiores as moedas mensais.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { name: "Gratuito", price: "R$ 0", monthly: "—", daily: "50 moedas/dia", featured: false, perks: ["500 moedas iniciais", "Jogos básicos", "Com anúncios"] },
            { name: "Bronze", price: "R$ 19,90", monthly: "3.000 moedas/mês", daily: "200 moedas/dia", featured: false, perks: ["Sem anúncios", "1 jogo exclusivo"] },
            { name: "Prata", price: "R$ 49,90", monthly: "10.000 moedas/mês", daily: "500 moedas/dia", featured: true, perks: ["Todos os jogos", "Suporte prioritário"] },
            { name: "Ouro", price: "R$ 99,90", monthly: "30.000 moedas/mês", daily: "2.000 moedas/dia", featured: false, perks: ["Badge VIP", "Torneios", "Suporte 24/7"] },
          ].map((p) => (
            <div
              key={p.name}
              className={`relative p-6 rounded-2xl border ${
                p.featured
                  ? "border-primary bg-gradient-to-b from-primary/10 to-card shadow-[var(--shadow-glow)]"
                  : "border-border bg-card/60"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-bold uppercase">
                  Popular
                </div>
              )}
              <h3 className="font-bold text-xl">{p.name}</h3>
              <div className="mt-2 text-3xl font-black">{p.price}<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
              <div className="mt-3 text-sm">
                <div className="text-accent font-semibold">{p.monthly}</div>
                <div className="text-muted-foreground">{p.daily}</div>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-primary" /> {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 Luxe Casino. Cassino social com moedas virtuais. Sem apostas com dinheiro real.</p>
      </footer>
    </div>
  );
}
