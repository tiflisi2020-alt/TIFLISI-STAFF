# Supabase Auth — ტიფლისი

მომხმარებელმა დაამტკიცა Manus OAuth-ის შეცვლა Supabase-ის ელფოსტა/პაროლით შესვლაზე. Supabase პროექტია `bbroknpeebjuilycutjd`; შემოწმებით email provider ჩართულია, რეგისტრაცია დაშვებულია, ავტომატური დადასტურება გათიშულია. მომხმარებლის შემოწმებისას Supabase Auth-ში ჯერ არცერთი ანგარიში არ იყო; აპლიკაციის ანგარიშების ცხრილში მენეჯერის ძველი Manus ანგარიში არსებობს.

## პარამეტრები

არსებულ Redirect URLs სიას უნდა დაემატოს `https://tiflisi-staff.vercel.app/login` და `https://tiflisi-staff.vercel.app/reset-password`. სხვა მისამართები არ უნდა წაიშალოს. მოთხოვნა კონკრეტულ `redirect_to`-ს უთითებს; Site URL-ის შეცვლა სხვა აპებს შეიძლება შეეხოს და საჭირო არ არის, თუ ზუსტი მისამართები დამატებულია. Dashboard URL: https://supabase.com/dashboard/project/bbroknpeebjuilycutjd/auth/url-configuration . მომხმარებელმა 2026-10-13 18:03 +04-ზე დაადასტურა ორივე ზუსტი Redirect URL-ის დამატება.

Supabase-ის ჩაშენებული ელფოსტის სერვისი საცდელია: ოფიციალური password guide-ის მიხედვით 2 წერილი/საათში, best-effort მიწოდება. რეალური გუნდისთვის SMTP შეიძლება გახდეს საჭირო. `email_address_not_authorized`, rate-limit და დადასტურების შეცდომები ინტერფეისში ქართულად უნდა გამოჩნდეს; მათი მოგვარების მიზნით დადასტურება არ უნდა გამოირთოს.

## უსაფრთხოება

სერვერი Supabase `/auth/v1/user`-ით ამოწმებს user identity-ს, დადასტურებულ email-ს და არ ანიჭებს უფლებას user_metadata.role-ს საფუძველზე. მენეჯერის ელფოსტა არის `merabtamoevi@gmail.com`. ძველი numeric account ID და დამოკიდებული კავშირები შენარჩუნდება მხოლოდ დადასტურებული იგივე email-ით შესვლის შემდეგ. პაროლები, access token-ები და request body ლოგებში არ უნდა მოხვდეს. browser hash token დაიშალოს მხოლოდ მეხსიერებაში და მისამართიდან დაუყოვნებლივ წაიშალოს.

## ოფიციალური წყაროები

- https://supabase.com/docs/guides/auth/passwords — signUp/signInWithPassword, აუცილებელი email confirmation, password recovery, email rate limit.
- https://supabase.com/docs/guides/auth/redirect-urls — დამატებითი ზუსტი redirect URLs, Site URL fallback, იმპლიციტური token hash ფრაგმენტი.
- https://supabase.com/docs/guides/auth/auth-email-templates — default ConfirmationURL, Token/TokenHash და server-side verify მეთოდები.

სესიის გასაუქმებლად `tiflisi_accounts` ცხრილს დაემატა `session_version integer not null default 0`. JWT-ში ჩაიწერება ვერსია; პაროლის აღდგენა ზრდის ვერსიას და ძველ სესიებს წვდომა აღარ აქვთ. აპლიკაციის cookie ვადა 8 საათია.

სესიის გაუქმება სრულდება service_role-only `invalidate_tiflisi_sessions` SQL ფუნქციის ატომური increment-ით; authenticated/anon მომხმარებლებს ფუნქციის შესრულება აკრძალული აქვთ. დამოუკიდებელი კოდის მიმოხილვით აღმოჩენილი ძველი OWNER_OPEN_ID bypass ორივე ადგილას მოიხსნა. მენეჯერის როლი ეფუძნება მხოლოდ დადასტურებულ შეთანხმებულ ელფოსტას.
