// PM2 — gerenciador de processo do backend SysGuarda.
// Uso na VPS:  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "sysguarda",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
      // As demais variáveis (DATABASE_URL, APP_PASSWORD, PORT, CLIENT_DIST)
      // vêm do arquivo server/.env, carregado via dotenv no index.ts.
    },
  ],
};
