export const SOCIAL_PLATFORMS = [
  { key: 'twitter', icon: 'twitter', label: 'Twitter' },
  { key: 'github', icon: 'github', label: 'GitHub' },
  { key: 'linkedin', icon: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', icon: 'instagram', label: 'Instagram' },
] as const

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key']
