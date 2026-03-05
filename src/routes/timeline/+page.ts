import type { PageLoad } from './$types';

// Disable SSR for the timeline app since it uses localStorage extensively
export const ssr = false;
export const prerender = false;

export const load: PageLoad = () => {
  return {};
};
