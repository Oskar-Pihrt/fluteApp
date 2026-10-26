/**
 * The app's tabs, as the navigation bar draws them.
 */
export const TABS = [
  {
    name: 'finder',
    label: 'Fingering',
    icon: 'M5 3v18M12 3v18M19 3v18M2 8h20M2 16h20',
  },
  {
    name: 'notes',
    label: 'Notes',
    icon: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  },
  {
    name: 'sheets',
    label: 'Sheets',
    icon: 'M5 3h9l5 5v13H5zM14 3v5h5',
  },
  {
    name: 'practice',
    label: 'Practice',
    // A flame: the daily streak.
    icon: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.5 2.5 3-.6-3 .2-5.6 0-8z',
  },
  {
    name: 'ear',
    label: 'Ear',
    // Headphones.
    icon: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z',
  },
  {
    name: 'settings',
    label: 'Setup',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.7 14H3.4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.7V3.4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.3 10h.3a2 2 0 1 1 0 4h-.2Z',
  },
] as const
