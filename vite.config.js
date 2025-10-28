import { defineConfig } from 'vite';

export default defineConfig(() => {
  const server = {
    port: 3000,
  };

  return {
    server,
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  };
});
