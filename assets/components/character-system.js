/**
 * Trip Tick — Character Component System (JavaScript Module)
 * Provides reusable UI generators for Character Cards, Avatars, Toasts, and Rosters.
 */

export const CHARACTERS = {
  dan: {
    id: 'dan',
    name: 'Dan',
    role: 'Trip Planner',
    icon: '🎒',
    asset: 'assets/images/dan_cutout.png',
    fullAsset: 'assets/images/dan_0.png'
  },
  james: {
    id: 'james',
    name: 'James',
    role: 'Adventurer',
    icon: '🧭',
    asset: 'assets/images/james_cutout.png',
    fullAsset: 'assets/images/james_0.png'
  },
  john: {
    id: 'john',
    name: 'John',
    role: 'Navigator',
    icon: '🗺️',
    asset: 'assets/images/john_cutout.png',
    fullAsset: 'assets/images/john_0.png'
  },
  matt: {
    id: 'matt',
    name: 'Matt',
    role: 'Explorer',
    icon: '🏔️',
    asset: 'assets/images/matt_cutout.png',
    fullAsset: 'assets/images/matt_0.png'
  },
  peter: {
    id: 'peter',
    name: 'Peter',
    role: 'Photographer',
    icon: '📷',
    asset: 'assets/images/peter_cutout.png',
    fullAsset: 'assets/images/peter_0.png'
  }
};

/**
 * Creates a Character Selection Card with hover-wiggle and click-spin animations.
 */
export function createCharacterCard({ charId, isSelected = false, isClaimed = false, claimedByName = '', onSelect }) {
  const char = CHARACTERS[charId];
  if (!char) throw new Error(`Character ${charId} not found`);

  const card = document.createElement('div');
  card.className = `tt-char-card ${isSelected ? 'selected' : ''} ${isClaimed ? 'claimed' : ''}`;
  card.dataset.charId = charId;

  card.innerHTML = `
    <div class="tt-badge">${isClaimed ? `Claimed by ${claimedByName}` : '✓'}</div>
    <div class="tt-char-stage">
      <img src="${char.asset}" class="tt-char-img" alt="${char.name}" />
      <div class="tt-char-shadow"></div>
    </div>
    <div class="tt-char-name">${char.name}</div>
    <div class="tt-char-role">${char.role}</div>
  `;

  if (!isClaimed) {
    card.addEventListener('click', () => {
      if (card.classList.contains('is-spinning')) return;
      card.classList.add('is-spinning');

      const willBeSelected = !card.classList.contains('selected');
      if (onSelect) onSelect(charId, willBeSelected);

      setTimeout(() => {
        card.classList.remove('is-spinning');
      }, 750);
    });
  }

  return card;
}

/**
 * Creates a Compact Micro-Avatar.
 */
export function createCharacterAvatar({ charId, size = 'md', onClick }) {
  const char = CHARACTERS[charId] || CHARACTERS.dan;

  const avatar = document.createElement('div');
  avatar.className = `tt-avatar tt-avatar-${size}`;
  avatar.dataset.charId = charId;
  avatar.innerHTML = `<img src="${char.asset}" alt="${char.name}" />`;

  avatar.triggerSpin = function () {
    avatar.classList.add('spin');
    setTimeout(() => avatar.classList.remove('spin'), 650);
  };

  if (onClick) {
    avatar.addEventListener('click', (e) => {
      avatar.triggerSpin();
      onClick(charId, e);
    });
  }

  return avatar;
}

/**
 * Displays a Micro-Toast Notification with an animated Character Badge.
 */
export function showCharacterToast({ charId = 'dan', title, message, duration = 3500 }) {
  let container = document.querySelector('.tt-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'tt-toast-container';
    document.body.appendChild(container);
  }

  const char = CHARACTERS[charId] || CHARACTERS.dan;
  const toast = document.createElement('div');
  toast.className = 'tt-toast';

  toast.innerHTML = `
    <div class="tt-toast-avatar">
      <img src="${char.asset}" alt="${char.name}" />
    </div>
    <div class="tt-toast-content">
      <div class="tt-toast-title">${title || char.name}</div>
      <div class="tt-toast-msg">${message || 'Updated status'}</div>
    </div>
  `;

  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 350);
  }, duration);

  return toast;
}

/**
 * Creates the 5-Traveler Lobby Status Roster.
 */
export function createCharacterRoster({ completedCharIds = [], onNudge }) {
  const roster = document.createElement('div');
  roster.className = 'tt-roster';

  Object.values(CHARACTERS).forEach(char => {
    const isDone = completedCharIds.includes(char.id);
    const item = document.createElement('div');
    item.className = `tt-roster-item ${isDone ? 'completed' : ''}`;
    item.dataset.charId = char.id;

    item.innerHTML = `
      <div class="tt-avatar tt-avatar-md">
        <img src="${char.asset}" alt="${char.name}" />
      </div>
      <div style="font-size: 0.85rem; font-weight: 700; color: #f8fafc; margin-top: 6px;">${char.name}</div>
      <div class="tt-roster-badge ${isDone ? 'done' : 'waiting'}">
        ${isDone ? '✓ Complete' : 'In Progress'}
      </div>
    `;

    item.setCompleted = function (completed) {
      if (completed && !item.classList.contains('completed')) {
        item.classList.add('just-submitted', 'completed');
        const badge = item.querySelector('.tt-roster-badge');
        badge.className = 'tt-roster-badge done';
        badge.textContent = '✓ Complete';
        setTimeout(() => item.classList.remove('just-submitted'), 800);
      }
    };

    roster.appendChild(item);
  });

  return roster;
}
