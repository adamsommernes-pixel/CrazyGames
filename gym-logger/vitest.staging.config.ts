import { defineConfig } from 'vitest/config';

// Tester mot et ekte Supabase-prosjekt (staging). Kjøres bare for hånd:
//   STAGING_SUPABASE_URL=https://<prosjekt>.supabase.co STAGING_SUPABASE_KEY=<publishable key> npm run test:staging
// Krever «Confirm email» slått av i staging-prosjektet.
// Lager noen få testkontoer og sletter dem igjen til slutt.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/staging/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
