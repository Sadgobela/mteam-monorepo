# mTeam

mTeam-ის უძრავი ქონების პლატფორმა: განცხადებები mTeam-ის ბროკერებისგან და მესაკუთრეებისგან.

## სტრუქტურა

```
apps/web         Next.js საიტი (ka / en / ru, ნათელი და მუქი თემა)
packages/shared  ტიპები, თარგმანები, ფორმატირება
packages/db      ბაზა (Prisma + PostgreSQL): სქემა, migration-ები, seed, მოთხოვნები
```

მობილური აპი (`apps/mobile`, Expo) მეორე ეტაპზე დაემატება.

## გაშვება

```bash
pnpm install
cp packages/db/.env.example packages/db/.env
cp packages/db/.env.example apps/web/.env.local
docker compose up -d                 # PostgreSQL და ფოტოების საცავი
pnpm --filter @mteam/db db:deploy    # migration-ები
pnpm --filter @mteam/db db:seed      # სანიმუშო განცხადებები, მხოლოდ დეველოპმენტისთვის
pnpm dev          # http://localhost:3000
pnpm test         # ტესტები, 100%-იანი დაფარვის მოთხოვნით
pnpm build
```

ადგილობრივად შესვლის კოდი SMS-ით არ იგზავნება: ის `pnpm dev`-ის ტერმინალში ჩანს (`[login code]`). ფოტოები SeaweedFS-ში ინახება; Cloudflare R2-ზე გადასვლა მხოლოდ `.env`-ის მნიშვნელობების შეცვლაა.

## წესები

- ყველა ცვლილებას ტესტი უნდა ახლდეს. დაფარვა 100%-ზე ნაკლები თუ იქნება, CI ჩავარდება.
- ტექსტი კოდში პირდაპირ არ იწერება: ის `packages/shared/src/i18n.ts`-ში სამივე ენაზე ემატება.
- ფერები მხოლოდ `apps/web/src/app/globals.css`-ის ტოკენებიდან გამოიყენება, რომ ორივე თემამ იმუშაოს.
