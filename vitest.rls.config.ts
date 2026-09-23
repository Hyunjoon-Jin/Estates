import { defineConfig } from 'vitest/config';

// Supabase 프로젝트에 실제로 붙는 RLS 통합 테스트. .env.test 에 URL/키가 있어야 실행된다.
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
