import { defineConfig } from 'vitest/config'

// Só o motor e os modelos de dados: nada de plugins do app (nem portas do Vite) nos testes.
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })
