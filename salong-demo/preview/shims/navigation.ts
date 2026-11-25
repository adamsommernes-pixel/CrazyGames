import { navigate, useRoute } from "../router";

export function usePathname(): string {
  return useRoute().path;
}

export function useRouter() {
  return { push: navigate, replace: navigate };
}
