import { ArrowRight, BarChart3, CheckCircle2, Clock3, CookingPot, Crown, GitBranch, LineChart, Printer, QrCode, ReceiptText, ShieldCheck, Sparkles, SquareMenu, Table2, UserRoundCheck, Users2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const platformFeatures = [
  {
    title: 'Live Order Visibility',
    detail: 'See incoming, preparing, ready, served, and cancelled orders instantly.',
    icon: BarChart3,
    group: 'Operations',
  },
  {
    title: 'Revenue Dashboard',
    detail: 'Track sales, avg ticket, paid orders, and growth in one place.',
    icon: Wallet,
    group: 'Analytics',
  },
  {
    title: 'Workspace Isolation',
    detail: 'Every restaurant runs in a dedicated workspace with secure data boundaries.',
    icon: ShieldCheck,
    group: 'Security',
  },
  {
    title: 'QR Table Management',
    detail: 'Create tables, generate QR codes, and deploy fast for dine-in.',
    icon: Table2,
    group: 'Admin',
  },
  {
    title: 'Menu Console',
    detail: 'Manage categories, items, prices, and images from admin.',
    icon: SquareMenu,
    group: 'Admin',
  },
  {
    title: 'Kitchen Queue',
    detail: 'Kitchen team receives live queue and updates status in seconds.',
    icon: CookingPot,
    group: 'Kitchen',
  },
  {
    title: 'Billing and Settlement',
    detail: 'Close bills quickly and mark payments by cash, card, or UPI.',
    icon: ReceiptText,
    group: 'Billing',
  },
  {
    title: 'Role-Based Access',
    detail: 'Separate owner, admin, and kitchen access with clean routing.',
    icon: UserRoundCheck,
    group: 'Access',
  },
  {
    title: 'QR-First Guest Ordering',
    detail: 'Guests scan and place orders without app install or account creation.',
    icon: QrCode,
    group: 'Guest',
  },
];

const operationSteps = [
  {
    no: '1',
    title: 'Workspace Setup',
    subtitle: 'Register a new workspace or sign in.',
    points: ['Restaurant and branch details', 'Owner, admin, kitchen credentials'],
  },
  {
    no: '2',
    title: 'Role Access',
    subtitle: 'Choose where to continue after workspace login.',
    points: ['Admin portal access', 'Kitchen view access'],
  },
  {
    no: '3',
    title: 'Menu and QR Setup',
    subtitle: 'Configure service fundamentals from admin.',
    points: ['Create categories and menu items', 'Create tables and generate QR codes'],
  },
  {
    no: '4',
    title: 'Guest Ordering',
    subtitle: 'Customers order directly from table QR.',
    points: ['Scan, browse, add to cart', 'Place order with confirmation'],
  },
  {
    no: '5',
    title: 'Kitchen Execution',
    subtitle: 'Kitchen runs live queue updates.',
    points: ['PENDING to PREPARING', 'READY to SERVED'],
  },
  {
    no: '6',
    title: 'Billing and Revenue',
    subtitle: 'Admin closes bills and tracks business.',
    points: ['Mark paid by method', 'View daily metrics and growth'],
  },
];

const customerFlow = [
  { title: 'Scan QR', hint: 'Table entry' },
  { title: 'Choose Items', hint: 'Category browse' },
  { title: 'Place Order', hint: 'Instant push' },
  { title: 'Kitchen Updates', hint: 'Live status' },
  { title: 'Pay & Close', hint: 'Bill complete' },
];

const kitchenFlow = [
  { title: 'Incoming Queue', hint: 'Orders grouped by table' },
  { title: 'Start Preparing', hint: 'Move PENDING to PREPARING' },
  { title: 'Mark Ready', hint: 'Notify service' },
  { title: 'Mark Served', hint: 'Close kitchen step' },
];

const adminFlow = [
  { title: 'Menu Console', hint: 'Manage categories and items' },
  { title: 'QR Tables', hint: 'Generate table QR codes' },
  { title: 'Live Orders', hint: 'Track status + totals' },
  { title: 'Mark Paid', hint: 'Close bill and revenue' },
];

const businessWhyPoints = [
  {
    title: 'Faster Ordering and Table Turnover',
    detail: 'Guests order instantly from table QR, increasing table turns per day.',
    icon: Clock3,
    result: 'More tables per shift',
  },
  {
    title: 'Reduced Staff Dependency',
    detail: 'Smaller teams serve more guests with fewer order-taking errors.',
    icon: Users2,
    result: 'Lower service overhead',
  },
  {
    title: 'No Menu Printing Cost',
    detail: 'Update prices digitally from admin with zero reprinting overhead.',
    icon: Printer,
    result: 'Instant menu changes',
  },
  {
    title: 'Realtime Kitchen and Billing Sync',
    detail: 'Orders reach kitchen and billing instantly, cutting confusion and delays.',
    icon: GitBranch,
    result: 'Fewer missed orders',
  },
  {
    title: 'Actionable Business Insights',
    detail: 'See best-sellers, peak hours, revenue, and AOV for smarter decisions.',
    icon: LineChart,
    result: 'Data-backed decisions',
  },
  {
    title: 'Higher Average Order Value',
    detail: 'Add-ons, combos, and visuals increase basket size and order value.',
    icon: Sparkles,
    result: 'Higher basket size',
  },
  {
    title: 'Hygienic Contactless Experience',
    detail: 'Contactless ordering improves hygiene and modern guest comfort.',
    icon: ShieldCheck,
    result: 'Modern guest trust',
  },
  {
    title: 'Premium Brand Perception',
    detail: 'A QR-first flow makes your brand look modern and premium.',
    icon: Crown,
    result: 'Stronger brand image',
  },
];

const demoTestimonials = [
  {
    quote:
      'Within the first month, we turned more tables during lunch without adding staff. Service feels faster and more controlled.',
    name: 'Ethan Miller',
    role: 'Owner, Harbor Brew Café',
    avatar: 'https://i.pravatar.cc/48?img=12',
  },
  {
    quote:
      'Order mistakes dropped sharply because requests now go straight from guest to kitchen. That alone improved customer satisfaction.',
    name: 'Sophia Lee',
    role: 'Operations Manager, Urban Spoon Bistro',
    avatar: 'https://i.pravatar.cc/48?img=32',
  },
  {
    quote:
      'Realtime status updates removed most back-and-forth between floor and kitchen. The team moves with less confusion.',
    name: 'Daniel Kent',
    role: 'Kitchen Lead, Cedar Leaf Kitchen',
    avatar: 'https://i.pravatar.cc/48?img=53',
  },
  {
    quote:
      'Menu changes used to take days because of reprints. Now we update prices in minutes from admin and go live instantly.',
    name: 'Olivia Parker',
    role: 'Co-Founder, Northline Coffee House',
    avatar: 'https://i.pravatar.cc/48?img=47',
  },
  {
    quote:
      'Our average bill value increased after adding combo highlights and visuals. Guests discover more without staff push.',
    name: 'Liam Foster',
    role: 'Director, Willow Street Diner',
    avatar: 'https://i.pravatar.cc/48?img=68',
  },
  {
    quote:
      'This gave us full visibility over orders and revenue in one flow. We finally have clean daily numbers we trust.',
    name: 'Emma Brooks',
    role: 'Owner, Ember & Bean Café',
    avatar: 'https://i.pravatar.cc/48?img=26',
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const [flowClockMs, setFlowClockMs] = useState(0);
  const qrValue = useMemo(() => {
    if (typeof window === 'undefined') return 'https://cafefluxe.app/';
    return window.location.href;
  }, []);
  useEffect(() => {
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setFlowClockMs(now - start);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const FLOW_CYCLE_MS = 6000;
  const FLOW_LOOP_GAP_MS = 4500;
  const FLOW_TOTAL_MS = FLOW_CYCLE_MS + FLOW_LOOP_GAP_MS;
  const FLOW_PAUSE_MS = 120;

  const getFlowMotion = (stepCount: number, clockMs: number) => {
    const phase = clockMs % FLOW_TOTAL_MS;
    const pauseTotal = stepCount * FLOW_PAUSE_MS;
    const moveTotalMs = Math.max(FLOW_CYCLE_MS - pauseTotal, 1);
    const checkpoints = [0, ...Array.from({ length: stepCount }, (_, i) => (i + 0.5) / stepCount), 1];

    if (phase >= FLOW_CYCLE_MS) {
      return { progress: 1, activeIndex: -1 };
    }

    let t = phase;
    for (let segment = 0; segment < checkpoints.length - 1; segment += 1) {
      const start = checkpoints[segment];
      const end = checkpoints[segment + 1];
      const distance = end - start;
      const moveMs = distance * moveTotalMs;

      if (t < moveMs) {
        return { progress: start + (t / Math.max(moveMs, 1)) * distance, activeIndex: -1 };
      }
      t -= moveMs;

      if (segment < stepCount) {
        if (t < FLOW_PAUSE_MS) {
          return { progress: checkpoints[segment + 1], activeIndex: segment };
        }
        t -= FLOW_PAUSE_MS;
      }
    }

    return { progress: 1, activeIndex: -1 };
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <main className="relative z-10 mx-auto w-full max-w-[1260px] px-6 md:px-10">
        <section className="grid min-h-[100svh] items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-2xl text-rose-500" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              ĆafeFluxe
            </p>
            <h1
              className="mt-4 max-w-4xl text-[clamp(2.8rem,7vw,6.2rem)] leading-[0.9] text-slate-900"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
              SCAN.
              <br />
              ORDER.
              <br />
              SERVE.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            A complete QR dining system — instant guest ordering, real-time kitchen sync, and centralized billing control.
              
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                onClick={() => navigate('/setup')}
                className="h-12 rounded-full bg-slate-900 px-8 text-base font-semibold text-white hover:bg-slate-800"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-slate-600">No app install for guests</span>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/setup?mode=login')}
                className="text-sm font-medium text-slate-900"
              >
                Already have a workspace?{' '}
                <span className="inline-block font-semibold text-[#00A000] underline underline-offset-4 transition-transform duration-200 ease-out hover:scale-110">
                &nbsp;Sign in.
                </span>
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex w-full max-w-[420px] flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live QR Scan</p>
            <div className="mt-4 flex flex-col items-center gap-4">
              <div className="relative inline-block">
                <QRCodeSVG value={qrValue} size={332} level="H" />
                <span className="qr-scan-line qr-scan-line--plain" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">Ready for customer scan</p>
                <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  Scanner active
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        <section id="business-impact" className="border-t border-slate-200/70 py-14 md:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Why Restaurants Choose This</p>
            <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.8rem)] leading-[0.96] text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Built for revenue, speed, and control.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
              Faster service on the floor, cleaner execution in the kitchen, and sharper business decisions for owners.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                {
                  kpi: '+24%',
                  label: 'Faster table turnover',
                  stroke: '#16a34a',
                  points: '2,46 16,42 30,40 44,36 58,34 72,30 86,28 100,24 114,22 128,18 140,16',
                },
                {
                  kpi: '-38%',
                  label: 'Order-taking mistakes',
                  stroke: '#ef4444',
                  points: '2,8 16,12 30,14 44,18 58,22 72,28 86,34 100,38 114,42 128,48 140,54',
                },
                {
                  kpi: '+17%',
                  label: 'Average order value',
                  stroke: '#16a34a',
                  points: '2,46 16,42 30,40 44,36 58,34 72,30 86,28 100,24 114,22 128,18 140,16',
                },
              ].map((item, idx) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[2.65rem] leading-none text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                        {item.kpi}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                    </div>
                    <div className="hidden w-[170px] shrink-0 md:block">
                      <svg viewBox="0 0 142 60" className="h-[64px] w-full">
                        <defs>
                          <linearGradient id={`kpi-mini-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={item.stroke} stopOpacity="0.24" />
                            <stop offset="100%" stopColor={item.stroke} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="12" x2="142" y2="12" stroke="#e2e8f0" strokeWidth="1" />
                        <polygon points={`${item.points} 140,58 2,58`} fill={`url(#kpi-mini-fill-${idx})`} />
                        <polyline
                          points={item.points}
                          fill="none"
                          stroke={item.stroke}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-x-12 md:grid-cols-2">
              {businessWhyPoints.map((point, idx) => {
                const Icon = point.icon;
                return (
                  <article key={point.title} className="group border-b border-slate-200/80 py-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors duration-200 group-hover:border-slate-900 group-hover:text-slate-900">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-xl leading-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                            {point.title}
                          </h3>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{point.detail}</p>
                        <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{point.result}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="platform-features" className="py-12">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">Features</p>
            <h2 className="mt-2 text-5xl leading-none text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Complete product capabilities
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 transition-colors duration-200 group-hover:bg-slate-900 group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{feature.group}</p>
                  </div>
                  <h3 className="mt-4 text-xl leading-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-slate-200/70 py-12 md:py-14">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Role Flows</p>
            <h2 className="mt-2 text-[clamp(1.8rem,4vw,3rem)] leading-[0.95] text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Customer, Kitchen, and Admin
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { title: 'Customer Flow', steps: customerFlow },
              { title: 'Kitchen Flow', steps: kitchenFlow },
              { title: 'Admin Flow', steps: adminFlow },
            ].map((flow) => {
              const motion = getFlowMotion(flow.steps.length, flowClockMs);

              return (
                <Card key={flow.title} className="sdc-panel-card gap-0 border border-slate-200/90 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{flow.title}</p>
                  <div className="mt-4 hidden sm:block">
                    <div className="relative">
                      <div
                        className="absolute top-4 z-[1] h-px overflow-hidden"
                        style={{ left: '16px', right: '16px' }}
                      >
                        <span className="block h-px bg-slate-900" style={{ width: `${motion.progress * 100}%` }} />
                      </div>
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${flow.steps.length}, minmax(0, 1fr))` }}>
                        {flow.steps.map((step, idx) => (
                          <div key={step.title} className="relative z-10 text-center">
                            <div
                              className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-300 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(251,113,133,0.3)] transition-transform duration-150 ${
                                motion.activeIndex === idx ? 'scale-[1.22]' : 'scale-100'
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <p className="mt-2 text-xs font-semibold leading-tight text-slate-700">{step.title}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{step.hint}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 sm:hidden">
                    {flow.steps.map((step, idx) => (
                      <div key={step.title} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/75 p-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-300 text-[10px] font-semibold text-white shadow-[0_6px_14px_rgba(251,113,133,0.28)]">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                        </div>
                        <p className="text-[10px] text-slate-500">{step.hint}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="flows-section" className="border-y border-slate-200/70 py-14 md:py-16">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-400">Operation Journey</p>
            <h2 className="mt-2 text-[clamp(2rem,4.5vw,4rem)] leading-[0.95] text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Zero to <span className="text-rose-500">live</span> in 6.
            </h2>
            <p className="mt-3 text-base text-slate-500">Complete launch workflow from setup to live service.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {operationSteps.map((step) => (
              <Card
                key={step.title}
                className="sdc-panel-card gap-0 overflow-hidden border border-slate-200/90 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.07)]"
              >
                <div className="-mx-6 -mt-6 mb-2 flex h-8 items-center bg-white px-4">
                  <span
                    className="inline-flex h-6 items-center bg-slate-900 px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
                    style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' }}
                  >
                    Step {step.no}
                  </span>
                </div>
                <h3 className="mt-0 text-4xl leading-none text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.subtitle}</p>
                <ul className="mt-4 space-y-1.5">
                  {step.points.map((point) => (
                    <li key={point} className="text-sm text-slate-600">
                      <span className="mr-2 text-slate-400">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section id="testimonials" className="border-t border-slate-200/70 py-14 md:py-16">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Testimonials</p>
            <h2 className="mt-2 text-[clamp(1.9rem,4.2vw,3.4rem)] leading-[0.96] text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              What restaurants say
            </h2>
          </div>
          <div className="testimonial-marquee overflow-hidden">
            <div className="testimonial-marquee-track">
              {[...demoTestimonials, ...demoTestimonials].map((item, idx) => (
                <article key={`${item.name}-${idx}`} className="testimonial-marquee-card rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm leading-relaxed text-slate-700">“{item.quote}”</p>
                  <div className="mt-5 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.avatar}
                        alt={item.name}
                        loading="lazy"
                        className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.role}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200/70 py-14 md:py-18">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-500">Go Live</p>
            <h3 className="mt-3 max-w-4xl text-[clamp(2rem,4.2vw,3.8rem)] leading-[0.95] text-slate-900" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Ready to transform your café?
            </h3>
            <p className="mt-3 max-w-3xl text-base text-slate-600">
            CafeFluxe helps modern cafés increase table turnover, reduce staff dependency, and boost revenue using smart QR-based ordering.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                onClick={() => navigate('/setup')}
                className="h-12 rounded-full bg-slate-900 px-7 text-base font-semibold text-white hover:bg-slate-800"
              >
                Start Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {['Faster table turns', 'Less staff dependency', 'Cleaner billing closure'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
