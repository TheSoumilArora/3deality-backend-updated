import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

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
  
  modules: {
    [Modules.PAYMENT]: {
      // this exposes the /store/payment-collections* routes
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            // “Manual / System” provider – perfect for your test flow
            resolve: '@medusajs/medusa/payment-manual',
            id: 'system',
            options: {},
          },
        ],
      },
    },
  },
})
