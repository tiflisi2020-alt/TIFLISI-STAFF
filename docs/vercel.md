# ტიფლისი — Vercel და Supabase Auth

მთავარი მისამართი: https://tiflisi-staff.vercel.app . GitHub წყარო: https://github.com/tiflisi2020-alt/TIFLISI-STAFF . `main`-ზე push ავტომატურად იწყებს Vercel გაშვებას. გრძელი deployment URL კონკრეტულ ძველ ვერსიაზე რჩება; გამოიყენე მთავარი მისამართი.

## აწყობა

| პარამეტრი | მნიშვნელობა |
| --- | --- |
| Framework | Other |
| Root Directory | რეპოზიტორიის ძირი |
| Install Command | pnpm install --frozen-lockfile |
| Build Command | pnpm run build:vercel |
| Output Directory | dist/public |
| Node | 22.x |

`api/index.js` იყენებს build-ისას CommonJS-ად შეფუთულ `server/vercel-handler.cjs` ფაილს. `/api/*` ემსახურება Express API, სხვა გვერდები React SPA-ა. Dockerfile Vercel-ზე არ გამოიყენება.

## სერვერის გარემო

- `SUPABASE_SERVICE_ROLE_KEY` — მხოლოდ დაცულ server ველში. არ გამოიყენო `VITE_`/`NEXT_PUBLIC_` პრეფიქსი. არ ჩადო გასაღები GitHub-ში.
- `MANUS_PROJECT_ID` — არსებული აპლიკაციის session audience; სახელის მიუხედავად აღარ არის ინტერაქტიული OAuth შესვლა.
- `MANUS_JWT_SECRET` — ცალკე შემთხვევითი signing secret ამ ჰოსტინგისთვის; existing უსაფრთხო მნიშვნელობა შენარჩუნებულია. არ გამოიყენო Preview-ის სხვა signing secret.
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — ტელეფონის შეტყობინების ერთი წყვილი. პირადი გასაღები მხოლოდ სერვერზე რჩება.

`MANUS_OAUTH_PORTAL_URL` და `MANUS_OAUTH_API_URL` აღარ მონაწილეობენ თანამშრომლის ინტერაქტიულ შესვლაში. ძველი მნიშვნელობების ყოფნა Manus-ზე გადამისამართებას არ ააქტიურებს.

## Supabase Auth

მომხმარებლის თანხმობით აპლიკაცია გადავიდა **Supabase email/password Auth-ზე**. `/login` აჩვენებს ქართულ შესვლისა და რეგისტრაციის ფორმებს; `/reset-password` ამუშავებს აღდგენის წერილის დაბრუნებას. ძველი `/api/oauth/start` მხოლოდ `/login`-ზე გადადის. მონაცემთა ბაზა ისევ `restaurant-schedule` პროექტია, `bbroknpeebjuilycutjd`.

Supabase Redirect URLs-ში დამატებულია (მომხმარებლის დადასტურებით):
- https://tiflisi-staff.vercel.app/login
- https://tiflisi-staff.vercel.app/reset-password

მენეჯერის პირველი ნაბიჯი: `/login` → რეგისტრაცია → `merabtamoevi@gmail.com` და საკუთარი ძლიერი პაროლი → მიღებული წერილის დადასტურება → შესვლა. პაროლი ჩატში არ გამოაგზავნო. მენეჯერის უფლება ენიჭება მხოლოდ Supabase-ის მიერ დადასტურებულ ამ email-ს; სხვა მომხმარებლის role ან metadata არ იძლევა ადმინისტრაციის წვდომას. ძველი ანგარიშის numeric ID და კავშირები გადაიბმება მხოლოდ დადასტურებული იგივე email-ით შესვლის შემდეგ.

Supabase-ის ჩაშენებული email sending საცდელი და შეზღუდულია; მიწოდების შეცდომის შემთხვევაში SMTP შეიძლება გახდეს საჭირო. დადასტურება არ გამოირთოს. უფრო ვრცლად: [Supabase Auth](supabase-auth.md).

## შემოწმება

`/api/health` აბრუნებს success-ს; `/api/auth/status` აბრუნებს `provider: supabase`. საჯარო roster და shifts Supabase-იდან იტვირთება. ანონიმურ admin API-ს წვდომა არ აქვს. ავტომატური ტესტები ანგარიშებისა და განრიგის რეალურ ცვლილებებს არ აკეთებს; ისინი ამოწმებს დაუდასტურებელი identity-ის უარს, cookie-ს უსაფრთხოებას, ძველი სესიების გაუქმებასა და verified-email migration-ს. მენეჯერის რეალური რეგისტრაცია/დადასტურება მომხმარებელმა პირადად უნდა დაასრულოს.
