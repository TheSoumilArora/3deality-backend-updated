import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },

  modules:
  {
    payment: {
      resolve: '@medusajs/medusa/payment',
      options: {
        // System provider is perfect for COD / offline flows
        providers: [{ id: 'pp_system', resolve: '@medusajs/medusa/payment' }],
      },
    },
  },
})