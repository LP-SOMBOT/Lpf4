
export const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/avataaars/svg?seed=";
export const POINTS_PER_QUESTION = 2;
export const MATCH_TIMEOUT_MS = 30000; // 30 seconds wait in lobby

export const generateAvatarUrl = (seed: string) => {
  // Enforce specific facial features for a neutral look
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&mouth=default&eyes=default&eyebrows=default&facialHairProbability=0`;
};