import { ArrowRight, CheckCircle2, Sparkles, Store } from 'lucide-react';
import { useNavigate } from 'react-router';
import logo12 from '../../assets/logo12.png';
import gradiantBg4 from '../../assets/gradiantbg4.jpg';
import { Button } from '../components/ui/button';

const steps = [
  { title: 'Welcome', detail: 'See what your workspace is built for', done: true },
  { title: 'Setup', detail: 'Configure your location and team access', done: false },
  { title: 'Go Live', detail: 'Choose Admin or Kitchen and start service', done: false },
];

export default function WelcomePage() {
  const navigate = useNavigate();

  const handleStart = () => navigate('/setup');

  return (
    <div
      className="relative min-h-screen overflow-hidden text-slate-900"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0.65) 100%), url(${gradiantBg4})`,
        backgroundSize: '100% 100%, cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-orange-100/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-8 h-60 w-60 rounded-full bg-cyan-100/70 blur-3xl" />

      <main className="mx-auto grid min-h-screen w-full max-w-[1360px] items-center gap-8 px-6 py-10 lg:grid-cols-[1.2fr_1fr]">
        <section className="glass-grid-card rounded-[32px] border-white/65 p-7 md:p-10">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Stories de Cafe Platform
          </div>

          <div className="flex items-center gap-4">
            <img src={logo12} alt="Stories de Cafe logo" className="h-14 w-14 object-contain md:h-16 md:w-16" />
            <h1 className="leading-[0.95] text-5xl text-slate-900 md:text-7xl" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome
            </h1>
          </div>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
            Launch your restaurant operations with a polished flow built for service speed. Register your workspace once, then sign in anytime and route directly to Admin or Kitchen.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleStart}
              className="h-12 rounded-full bg-slate-900 px-7 text-[15px] font-semibold text-white hover:bg-slate-800"
            >
              Start Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/70 px-5 text-sm text-slate-700">
                <Store className="h-4 w-4 text-teal-700" />
                Setup + Login in one place
            </div>
          </div>
        </section>

        <section className="glass-grid-card rounded-[32px] border-white/65 p-7 md:p-10">
          <h2 className="text-2xl text-slate-900 md:text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your Launch Sequence
          </h2>
          <p className="mt-2 text-sm text-slate-600 md:text-base">Every customer will follow this sequence on first launch.</p>

          <div className="mt-7 space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
