import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import logo12 from '../../assets/logo12.png';
import gradiantBg5 from '../../assets/gradiantbg5.jpg';
import administratorIcon from '../../assets/administrator.png';
import utensilsIcon from '../../assets/utensils.png';
import { clearWorkspaceSession, getCurrentWorkspaceProfile } from '../lib/workspaceAuth';

export default function HomePage() {
  const navigate = useNavigate();
  const workspace = getCurrentWorkspaceProfile();
  const displayBrand = workspace?.restaurantName || 'Stories de Cafe';
  const displayOutlet = workspace?.outletName || 'Main Outlet';

  const handleSwitchWorkspace = () => {
    clearWorkspaceSession();
    navigate('/setup');
  };

  return (
    <div
      className="page-shell h-screen overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(180deg, #ffffff 0%, #ffffff 12%, rgba(255,255,255,0.82) 22%, rgba(255,255,255,0.28) 34%, rgba(255,255,255,0) 46%), url(${gradiantBg5})`,
        backgroundSize: '100% 100%, cover',
        backgroundPosition: 'top left, center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="mx-auto grid h-full w-full max-w-[1520px] grid-rows-[auto_1fr_auto] px-8 py-8 md:px-10 md:py-9">
        <div className="pt-4 text-center">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleSwitchWorkspace}
              className="rounded-full border border-black/15 bg-white/65 px-4 py-2 text-sm font-medium text-black transition hover:bg-white"
            >
              Switch Workspace
            </button>
          </div>
          <div className="inline-flex items-center gap-5">
              <img src={logo12} alt="Stories de Café" className="-translate-y-3 h-[clamp(80px,5.8vw,136px)] w-[clamp(80px,5.8vw,136px)] object-contain" />
              <h1
                className="leading-none text-black [font-size:clamp(74px,5.8vw,132px)]"
                style={{ fontFamily: "'Great Vibes', cursive", fontWeight: 400 }}
              >
                {displayBrand}
              </h1>
          </div>
          <p className="-mt-2 text-black/75 [font-size:clamp(14px,1.1vw,22px)]">{displayOutlet}</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(24px,3.5vw,56px)]">
          <div className="flex w-full justify-center">
            <section className="w-full max-w-[560px] translate-x-29 self-center">
              <div className="inline-flex translate-x-3 items-center gap-2">
                <img src={administratorIcon} alt="" aria-hidden="true" className="h-[clamp(25px,2.05vw,46px)] w-[clamp(25px,2.05vw,46px)] object-contain" />
                <p className="leading-none text-black [font-size:clamp(16px,1.45vw,30px)]">Control Center</p>
              </div>
              <h2 className="mt-1.5 leading-[0.96] font-medium text-black [font-size:clamp(44px,3.95vw,78px)]">Admin Portal</h2>
              <p className="mt-2.5 leading-[1.1] text-black [font-size:clamp(16px,1.45vw,30px)]">Manage menu, tables, and orders.</p>
              <button
                type="button"
                onClick={() => navigate('/admin/login')}
                className="mt-[clamp(20px,3.2vh,44px)] inline-flex items-center gap-3 leading-none font-medium text-black transition-all duration-200 hover:[font-size:clamp(18px,1.62vw,33px)] [font-size:clamp(16px,1.45vw,30px)]"
              >
                <span>Access Admin</span>
                <ArrowRight className="h-[clamp(20px,1.8vw,34px)] w-[clamp(20px,1.8vw,34px)]" strokeWidth={2.1} />
              </button>
            </section>
          </div>

          <div className="h-[clamp(240px,35vh,430px)] w-[3px] self-center bg-black" />

          <div className="flex w-full justify-center">
            <section className="w-full max-w-[560px] translate-x-28 self-center">
              <div className="inline-flex items-center gap-2">
                <img src={utensilsIcon} alt="" aria-hidden="true" className="h-[clamp(22px,1.85vw,40px)] w-[clamp(22px,1.85vw,40px)] object-contain" />
                <p className="leading-none text-black [font-size:clamp(16px,1.45vw,30px)]">Live Queue</p>
              </div>
              <h2 className="mt-1.5 leading-[0.96] font-medium text-black [font-size:clamp(44px,3.95vw,78px)]">Kitchen View</h2>
              <p className="mt-2.5 leading-[1.1] text-black [font-size:clamp(16px,1.45vw,30px)]">View and manage incoming orders.</p>
              <button
                type="button"
                onClick={() => navigate('/kitchen/login')}
                className="mt-[clamp(20px,3.2vh,44px)] inline-flex items-center gap-3 leading-none font-medium text-black transition-all duration-200 hover:[font-size:clamp(18px,1.62vw,33px)] [font-size:clamp(16px,1.45vw,30px)]"
              >
                <span>Open Kitchen View</span>
                <ArrowRight className="h-[clamp(20px,1.8vw,34px)] w-[clamp(20px,1.8vw,34px)]" strokeWidth={2.1} />
              </button>
            </section>
          </div>
        </div>

        <p className="mx-auto max-w-[1320px] pb-3 text-center leading-[1.24] text-black [font-size:clamp(14px,1.2vw,24px)]">
          Choose your workspace to run daily operations, track incoming orders, and complete service smoothly.
        </p>
      </div>
    </div>
  );
}
