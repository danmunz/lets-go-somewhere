import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import logoUrl from '../../../design-system/assets/logo.png';
import { journeyItem, journeyItems, type JourneyDestination } from '../journeyNavigation.js';

export type { JourneyDestination } from '../journeyNavigation.js';

type Props = {
  active: JourneyDestination;
  revealOpen: boolean;
  revealSeen?: boolean;
  onNavigate: (destination: JourneyDestination) => void;
  onOpenHowItWorks: () => void;
};

const focusableSelector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The only global navigator in the app. It is rendered exclusively after a
 * traveler has finished their choices; the server still owns every data gate.
 */
export function JourneyNav({ active, revealOpen, revealSeen = false, onNavigate, onOpenHowItWorks }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const items = journeyItems(revealOpen);
  const activeItem = journeyItem(active);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) window.setTimeout(() => toggleRef.current?.focus(), 0);
  };
  const navigate = (destination: JourneyDestination) => {
    closeMenu();
    onNavigate(destination);
  };
  const openHelp = () => {
    closeMenu();
    onOpenHowItWorks();
  };

  useEffect(() => {
    if (!menuOpen) return;
    window.setTimeout(() => activeItemRef.current?.focus(), 0);
  }, [menuOpen]);

  const trapSheetFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <>
    <header className="journey-nav" aria-label="Your trip navigation">
      <div className="journey-nav__inner">
        <img className="journey-nav__logo" src={logoUrl} alt="Let’s Go Somewhere" />
        <nav className="journey-nav__desktop" aria-label="Your trip">
          {items.map((item) => <button key={item.destination} type="button" onClick={() => navigate(item.destination)} aria-current={active === item.destination ? 'page' : undefined}>
            {item.label}
            {item.destination === 'verdict' && !revealSeen && <i className="journey-nav__new-dot" aria-label="New" />}
          </button>)}
        </nav>
        <button className="journey-nav__help journey-nav__desktop" type="button" onClick={openHelp}><span aria-hidden="true">?</span>How it works</button>
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
      <div id="journey-nav-sheet" ref={sheetRef} className="journey-nav__sheet" role="dialog" aria-modal="true" aria-label="Your trip navigation" onKeyDown={trapSheetFocus}>
        <p className="journey-nav__sheet-kicker">Your trip</p>
        <nav aria-label="Your trip destinations">
          {items.map((item) => <button key={item.destination} ref={active === item.destination ? activeItemRef : undefined} type="button" className={active === item.destination ? 'is-active' : undefined} onClick={() => navigate(item.destination)} aria-current={active === item.destination ? 'page' : undefined}>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
            {item.destination === 'verdict' && !revealSeen && <i className="journey-nav__new-dot" aria-label="New" />}
            {active === item.destination && <em>Current page</em>}
          </button>)}
        </nav>
        <button type="button" className="journey-nav__sheet-help" onClick={openHelp}><span aria-hidden="true">?</span>How it works</button>
      </div>
    </div>}
  </>;
}
