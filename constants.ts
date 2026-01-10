
export const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/avataaars/svg?seed=";
export const POINTS_PER_QUESTION = 2;
export const MATCH_TIMEOUT_MS = 10000; // Ranked/Auto: 10 seconds
export const PRIVATE_ROOM_TIMEOUT_MS = 15000; // Social/Private: 15 seconds

// Official App Logo as Avatar (Orange Gradient Background with Cap)
export const APP_LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f97316' /%3E%3Cstop offset='100%25' stop-color='%23ea580c' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='512' height='512' fill='url(%23grad)' rx='100' ry='100' /%3E%3Ctext x='50%25' y='55%25' font-size='280' text-anchor='middle' dy='.35em'%3E🎓%3C/text%3E%3C/svg%3E";

export const generateAvatarUrl = (seed: string) => {
  // Enforce specific facial features for a neutral look
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&mouth=default&eyes=default&eyebrows=default&facialHairProbability=0`;
};