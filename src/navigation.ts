/**
 * The app's tabs — the navigation bar draws them, and the welcome screen
 * explains them, so both stay in step.
 */
export const TABS = [
  {
    name: 'finder',
    label: 'Fingering',
    icon: 'M5 3v18M12 3v18M19 3v18M2 8h20M2 16h20',
    about: 'Tap the keys you hold down and see every note that fingering plays.',
  },
  {
    name: 'notes',
    label: 'Notes',
    icon: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    about: 'Your whole range, note by note, with every way to finger each one.',
  },
  {
    name: 'sheets',
    label: 'Sheets',
    icon: 'M5 3h9l5 5v13H5zM14 3v5h5',
    about:
      'Photograph or import a piece and get the fingering for every note — or rewrite it for another instrument.',
  },
  {
    name: 'ear',
    label: 'Ear',
    // Headphones.
    icon: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z',
    about: 'Ear training: name notes and intervals by ear, with levels that grow with you.',
  },
  {
    name: 'settings',
    label: 'Setup',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.7 14H3.4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.7V3.4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.3 10h.3a2 2 0 1 1 0 4h-.2Z',
    about: 'Your instruments and their keys, sound, and backups of your sheets.',
  },
] as const
