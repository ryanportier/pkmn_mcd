# $PKMN — Catch. Evolve. Earn. 🔴⚪

Token meme Pokémon en Base (Ethereum L2). Hold $PKMN, evoluciona tu Pokémon, gana ETH del vault.

## Stack

- **Next.js 16** (App Router, Turbopack, CSS Modules)
- **Supabase** (DB + Realtime)
- **Viem** (cliente Base L2)
- **Alchemy** (indexar holders ERC-20)
- **DexScreener API** (precio en tiempo real, sin API key)
- **SIWE** (Sign-In With Ethereum)

---

## Setup rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ALCHEMY_API_KEY=tu_alchemy_key
NEXT_PUBLIC_BASE_RPC=https://base-mainnet.g.alchemy.com/v2/tu_alchemy_key

NEXT_PUBLIC_PKMN_CONTRACT=0xTU_CONTRACT_ADDRESS_AQUI

JWT_SECRET=genera_con_openssl_rand_hex_32

CRON_SECRET=otro_string_secreto
NEXT_PUBLIC_APP_URL=http://localhost:3000

VAULT_ROUND_DURATION_SECONDS=3600
VAULT_PAYOUT_PERCENT=80
```

### 3. Crear tablas en Supabase

1. Ve a **Supabase Dashboard → SQL Editor**
2. Copia y ejecuta el contenido de `supabase/schema.sql`
3. Ve a **Database → Replication** y activa Realtime para las tablas `holders`, `vault_rounds`, `payouts`

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Sincronizar holders on-chain

El leaderboard se alimenta de datos on-chain sincronizados a Supabase.

**Manual (desarrollo):**
```bash
npm run sync-holders
```

**Producción con cron** (Vercel Cron Jobs en `vercel.json`):
```json
{
  "crons": [{
    "path": "/api/holders/sync",
    "schedule": "*/5 * * * *"
  }]
}
```
> Recuerda setear `CRON_SECRET` en las variables de entorno de Vercel.

---

## Integración con Base MCP

Una vez que el usuario conecta su wallet (SIWE), puede usar **Base MCP** desde Claude para:
- Ver su balance de $PKMN
- Hacer swaps directamente desde el chat
- Transferir tokens
- Ver el estado del vault

El servidor Base MCP se conecta via OAuth 2.1 a la Base App. No requiere claves privadas.

### Ejemplo de uso con Claude

```
"Swap 0.01 ETH por $PKMN en Base"
"¿Cuánto $PKMN tengo en mi wallet?"
"Transferir 1000 $PKMN a 0x..."
```

---

## Estructura del proyecto

```
pkmn-base/
├── app/
│   ├── layout.tsx              # Root layout + fonts + providers
│   ├── page.tsx                # Homepage (Hero + Starters + Vault + Leaderboard)
│   └── api/
│       ├── auth/nonce/         # GET  — genera nonce SIWE
│       ├── auth/verify/        # POST — verifica firma SIWE, devuelve JWT
│       ├── dashboard/          # GET  — datos del dashboard (polled c/5s)
│       ├── trainer/            # GET  — datos de un trainer por wallet
│       ├── vault/              # GET  — estado del vault activo
│       └── holders/sync/       # POST — sync on-chain → Supabase (cron)
├── components/
│   ├── Nav/                    # Barra de navegación sticky
│   ├── PriceBar/               # Ticker de precio DexScreener
│   ├── Hero/                   # Hero section con CA y botones
│   ├── StarterSelection/       # Cards de Pokémon iniciales
│   ├── VaultCountdown/         # Cuenta regresiva + tabla de evolución
│   ├── Leaderboard/            # Rankings en vivo
│   ├── PayoutsPanel/           # Historial de payouts
│   ├── HowItWorks/             # Explicación del juego
│   └── Footer/
├── context/
│   └── WalletContext.tsx       # Estado de wallet + SIWE connect/disconnect
├── hooks/
│   └── useDashboard.ts         # Poll /api/dashboard cada 5s
├── lib/
│   ├── pokemon.ts              # Datos, lógica evolución, helpers de formato
│   ├── supabase.ts             # Clientes browser + admin
│   ├── viem.ts                 # Cliente Base L2
│   ├── alchemy.ts              # Fetch holders ERC-20
│   ├── dexscreener.ts          # Precio del token
│   └── auth.ts                 # SIWE + JWT
├── types/
│   └── index.ts                # TypeScript types
├── styles/
│   └── globals.css             # Variables CSS + reset + utilidades
├── supabase/
│   └── schema.sql              # DDL + RLS + función settle_vault
└── scripts/
    └── syncHolders.ts          # Script manual de sync
```

---

## Deploy en Vercel

```bash
vercel --prod
```

Variables de entorno: agrégalas en **Vercel Dashboard → Settings → Environment Variables**.

---

## Agregar tu contract address

1. Deploya el token ERC-20 en Base Mainnet
2. Copia la contract address
3. Actualiza `NEXT_PUBLIC_PKMN_CONTRACT` en `.env.local` (y en Vercel)
4. Actualiza el link de DexScreener en `Footer.tsx`
5. Corre `npm run sync-holders` para poblar el leaderboard

---

## Mecánica del juego

| Concepto | Descripción |
|---|---|
| **Pokémon asignado** | Determinístico por wallet (hash → Bulbasaur/Charmander/Squirtle) |
| **Evolución** | LV1→LV5 según balance: 0 / 1K / 10K / 100K / 1M tokens |
| **Score** | `balance × (segundos_held / 3600) × multiplicador` |
| **Multiplicador** | `nivel_evolución × 2` si tiene callout verificado |
| **Vault** | Se llena con fees de trading cada round |
| **Payout** | `tu_score / total_scores × vault_total` al finalizar cada round |
| **Hold time** | Se resetea si vendes (balance baja) |

---

## Licencia

MIT
