import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import logoUrl from '../../../design-system/assets/logo.png';
import {
  journeyItems,
  lightningItems,
  type JourneyDestination,
  type LightningNavigationDestination,
} from '../journeyNavigation.js';

export type { JourneyDestination, LightningNavigationDestination } from '../journeyNavigation.js';

const focusableSelector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type RoundSwitcherProps = {
  current: 'round-one' | 'lightning';
  onOpenRoundOne: () => void;
  onOpenLightning: () => void;
};

function RoundSwitcher({ current, onOpenRoundOne, onOpenLightning }: RoundSwitcherProps) {
  return <div className="round-switcher" role="group" aria-label="Switch trip rounds">
    <button type="button" className={current === 'round-one' ? 'is-active' : undefined} aria-pressed={current === 'round-one'} onClick={onOpenRoundOne}>Round 1</button>
    <button type="button" className={current === 'lightning' ? 'is-active' : undefined} aria-pressed={current === 'lightning'} onClick={onOpenLightning}>Lightning Round</button>
  </div>;
}

type NavItem<T extends string> = { destination: T; label: string; description: string };
type SharedNavProps<T extends string> = {
  active: T;
  items: readonly NavItem<T>[];
  kicker: string;
  onNavigate: (destination: T) => void;
  onOpenHelp: () => void;
  helpLabel: string;
  roundSwitcher?: RoundSwitcherProps;
  revealSeen?: boolean;
  showNew?: boolean;
};

function SharedNav<T extends string>({ active, items, kicker, onNavigate, onOpenHelp, helpLabel, roundSwitcher, revealSeen = true, showNew = false }: SharedNavProps<T>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const activeItem = items.find((item) => item.destination === active) ?? items[0]!;
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) window.setTimeout(() => toggleRef.current?.focus(), 0);
  };
  const navigate = (destination: T) => { closeMenu(); onNavigate(destination); };
  const openHelp = () => { closeMenu(); onOpenHelp(); };

  useEffect(() => {
    if (menuOpen) window.setTimeout(() => activeItemRef.current?.focus(), 0);
  }, [menuOpen]);

  const trapSheetFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <>
    <header className="journey-nav" aria-label={`${kicker} navigation`}>
      <div className="journey-nav__inner">
        <img className="journey-nav__logo" src={logoUrl} alt="Let’s Go Somewhere" />
        {roundSwitcher && <div className="journey-nav__rounds journey-nav__desktop"><RoundSwitcher {...roundSwitcher} /></div>}
        <nav className="journey-nav__desktop" aria-label={kicker}>
          {items.map((item) => <button key={item.destination} type="button" onClick={() => navigate(item.destination)} aria-current={active === item.destination ? 'page' : undefined}>
            {item.label}
            {showNew && item.destination === 'verdict' && !revealSeen && <i className="journey-nav__new-dot" aria-label="New" />}
          </button>)}
        </nav>
        <button className="journey-nav__help journey-nav__desktop" type="button" onClick={openHelp}><span aria-hidden="true">?</span>{helpLabel}</button>
        <div className="journey-nav__mobile">
          <p aria-live="polite">{activeItem.label}</p>
          <button ref={toggleRef} type="button" className="journey-nav__menu-toggle" aria-expanded={menuOpen} aria-controls="journey-nav-sheet" onClick={() => setMenuOpen((open) => !open)}>
            <span>Menu</span><i aria-hidden="true"><b /><b /><b /></i>
          </button>
        </div>
      </div>
    </header>
    {menuOpen && <div className="journey-nav__mobile-layer">
      <button className="journey-nav__backdrop" type="button" tabIndex={-1} aria-label="Close navigation menu" onClick={() => closeMenu(true)} />
      <div id="journey-nav-sheet" ref={sheetRef} className="journey-nav__sheet" role="dialog" aria-modal="true" aria-label={`${kicker} navigation`} onKeyDown={trapSheetFocus}>
        <p className="journey-nav__sheet-kicker">{kicker}</p>
        {roundSwitcher && <section className="journey-nav__round-sheet" aria-label="Switch rounds"><p>Switch rounds</p><RoundSwitcher {...roundSwitcher} /></section>}
        <nav aria-label={`${kicker} destinations`}>
          {items.map((item) => <button key={item.destination} ref={active === item.destination ? activeItemRef : undefined} type="button" className={active === item.destination ? 'is-active' : undefined} onClick={() => navigate(item.destination)} aria-current={active === item.destination ? 'page' : undefined}>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
            {showNew && item.destination === 'verdict' && !revealSeen && <i className="journey-nav__new-dot" aria-label="New" />}
            {active === item.destination && <em>Current page</em>}
          </button>)}
        </nav>
        <button type="button" className="journey-nav__sheet-help" onClick={openHelp}><span aria-hidden="true">?</span>{helpLabel}</button>
      </div>
    </div>}
  </>;
}

type JourneyNavProps = {
  active: JourneyDestination;
  revealOpen: boolean;
  revealSeen?: boolean;
  onNavigate: (destination: JourneyDestination) => void;
  onOpenHowItWorks: () => void;
  onOpenLightning?: () => void;
};

/** Original-round navigator, shown only after the original 32 choices are complete. */
export function JourneyNav({ active, revealOpen, revealSeen = false, onNavigate, onOpenHowItWorks, onOpenLightning }: JourneyNavProps) {
  return <SharedNav
    active={active}
    items={journeyItems(revealOpen)}
    kicker="Round 1 results"
    onNavigate={onNavigate}
    onOpenHelp={onOpenHowItWorks}
    helpLabel="How it works"
    revealSeen={revealSeen}
    showNew
    roundSwitcher={onOpenLightning ? { current: 'round-one', onOpenRoundOne: () => undefined, onOpenLightning } : undefined}
  />;
}

type LightningNavProps = {
  active: LightningNavigationDestination;
  revealOpen: boolean;
  onNavigate: (destination: LightningNavigationDestination) => void;
  onOpenRoundOne: () => void;
  onOpenLightning: () => void;
  onOpenHelp: () => void;
};

/** Lightning's post-veto navigator. It never mixes original result links into this round's destinations. */
export function LightningNav({ active, revealOpen, onNavigate, onOpenRoundOne, onOpenLightning, onOpenHelp }: LightningNavProps) {
  return <SharedNav
    active={active}
    items={lightningItems(revealOpen)}
    kicker="Lightning Round"
    onNavigate={onNavigate}
    onOpenHelp={onOpenHelp}
    helpLabel="About this round"
    roundSwitcher={{ current: 'lightning', onOpenRoundOne, onOpenLightning }}
  />;
}

type LightningFocusHeaderProps = { status: string; onOpenRoundOne: () => void };

/** A deliberately small context bar for active direct choices and the required veto step. */
export function LightningFocusHeader({ status, onOpenRoundOne }: LightningFocusHeaderProps) {
  return <header className="lightning-focus-nav" aria-label="Lightning Round context">
    <img src={logoUrl} alt="Let’s Go Somewhere" />
    <p><strong>Round 2</strong><span>Lightning Round</span></p>
    <output aria-live="polite">{status}</output>
    <button type="button" onClick={onOpenRoundOne}>Round 1 results</button>
  </header>;
}
