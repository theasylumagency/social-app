# Post Generation Reliability & Model Routing

განხორციელდა ბრიფის მიხედვით, პრომპტების, პოსტების სქემებისა და შენახვის არქიტექტურის შეცვლის გარეშე.

## მოდელების განაწილება

სერვერის `.env.local`-ში გამოიყენეთ:

```env
OPENAI_POST_PLANNER_MODEL=gpt-5.6-terra
OPENAI_POST_WRITER_MODEL=gpt-5.6-sol
OPENAI_POST_REVIEW_MODEL=gpt-5.6-terra
OPENAI_PLANNING_MODEL=gpt-5.6-terra
OPENAI_BRAND_MODEL=gpt-5.6-terra
OPENAI_EXTRACTION_MODEL=gpt-5.4-nano
OPENAI_EXTRACTION_FALLBACK_MODEL=gpt-5.6-terra
```

`post_schedule` იყენებს Planner-ს, `post_writer_*` — Writer-ს, `post_review` — Reviewer-ს. Planner/Reviewer-ის ცვლადის არქონის ან სიცარიელისას გამოიყენება `OPENAI_PLANNING_MODEL`, შემდეგ Terra. Writer-ის fallback ყოველთვის Sol-ია. Brand-ისა და კვირის მოდელის ცვლადების მხარდაჭერა უკვე არსებობდა; შეიცვალა ნაგულისხმევი მნიშვნელობა Terra-ზე. Extraction-ის მხარდაჭერა და არსებული nano → Terra fallback უცვლელია. `.env.example` განახლებულია, მაგრამ არსებული სერვერის ცვლადებს არ გადაწერს.

## ვადები და ხელახალი ცდა

- თითო HTTP მოთხოვნა: **150 წამი**, ახალი timeout signal თითო ცდაზე, პასუხის წაკითხვის ჩათვლით.
- **ერთი transient retry მთელი ლოგიკური გამოძახებისთვის**, 1-წამიანი პაუზით: TimeoutError, დროებითი ქსელის შეცდომები, HTTP 429/500/502/503/504.
- მუდმივი 4xx შეცდომები, უცნობი შეცდომები, სერტიფიკატის პრობლემა და incomplete პასუხი ამ retry-ს არ იწვევს.
- კონტრაქტის არსებული ერთი გასწორება შენარჩუნებულია. დროებითი შეცდომის განმეორება არ ხარჯავს გასწორების ცდას და თავიდან არ წერს გასწორების სწორ ნაწილებს.
- მაქსიმუმ **3 მოთხოვნა** ერთ ლოგიკურ გამოძახებაზე: 2 კონტრაქტის ცდა + 1 transient retry. მოთხოვნებისა და backoff-ის ზედა ჯამი: **451 წამი**.
- worker-ის ეტაპის დასაწყებად საჭიროა **480 წამი** დარჩენილი ბიუჯეტი; ერთი გაშვების ბიუჯეტია **540 წამი**, lease — **600 წამი**. პარალელური პოსტები ამავე დაცულ ეტაპში სრულდება. იგივე საერთო კლიენტის მომხმარებელი ბრენდისა და კვირის worker-ების ვადებიც შეთანხმებულია.

წარმატებული პოსტი მაშინვე ინახება. სხვა პოსტის განმეორებითი შეცდომის შემდეგ worker ინახავს გაგრძელებად failed მდგომარეობას. ხელახალი გაშვება მხოლოდ დაკარგულ ტექსტებს წერს. ბაზაში აუდიტის ჩაწერის შეცდომა მოდელის განმეორებით გამოძახებას არ იწვევს.

## შესრულება და დიაგნოსტიკა

ბრენდისა და კვირის API მარშრუტებიდან ამოღებულია მძიმე `after()` შესრულება. მოთხოვნა მოწმდება, რიგში ინახება და პასუხი ბრუნდება; ერთადერთი მუდმივი შესრულების მფლობელია `worker:operator`. კვირის worker პოსტების რიგს ქმნის არსებული ტრანზაქციით, შემდეგ პოსტებს operator-ის ცალკე claim ემსახურება. `resume` API მხოლოდ მდგომარეობას აბრუნებს.

ლოგებში განსხვავდება `timeout`, `network`, `http` სტატუსით, `incomplete`, `contract`, `lost_lease` და `unknown`. პოსტების worker ინარჩუნებს პარალელური ცდის თავდაპირველ შეცდომას. ლოგში შედის ეტაპი, მოდელი, run ID და დაშვებული დიაგნოსტიკური ველები; არ შედის API გასაღები, პრომპტი, წყაროს ტექსტი ან პროვაიდერის შეცდომის სრული პასუხი.

## სერვერზე განახლება

1. განაახლეთ კოდი და ზემოთ ჩამოთვლილი მოდელების ცვლადები.
2. გაუშვით `npm ci` და `npm run build`. ამ ცვლილებას ახალი მიგრაცია არ სჭირდება.
3. გადატვირთეთ ვებპროცესი და მუდმივი `worker:operator` / `worker:discovery`. მოდელების გარემოს ახალი ცვლადებიც უნდა ჩაიტვირთოს.
4. მიმდინარე გრძელი სამუშაოს დასასრულებლად პროცესის მმართველის გაჩერების ვადა სასურველია მინიმუმ 600 წამი იყოს. ახალი lease უკვე ახალ claim-ზე მოქმედებს; ძველი პროცესის გაჩერების შემდეგ მიტოვებულ სამუშაოს worker lease-ის ამოწურვისას გააგრძელებს.
5. ადრე შეჩერებულ პოსტზე გამოიყენეთ „მომზადების გაგრძელება“; ბრენდის თავიდან გენერაცია საჭირო არ არის.

## შეცვლილი ფაილები

- `.env.example`, `package.json`, `README.md`
- `src/infrastructure/models/runtime-policy.ts` — მოდელების განაწილება, ვადები და უსაფრთხო შეცდომის კლასიფიკაცია.
- `src/infrastructure/models/brand-reasoning.ts` — timeout, transient retry და აუდიტი.
- `src/worker/weekly-posts.ts`, `weekly-planning.ts`, `brand-discovery.ts` — ვადების შეთანხმება და ლოგები.
- `src/infrastructure/postgres/weekly-posts-store.ts`, `weekly-planning-store.ts`, `brand-discovery-store.ts` — lease.
- `src/app/api/weekly-planning/route.ts`, `src/app/api/brand-discovery/route.ts` — მხოლოდ რიგში შენახვა და მდგომარეობის ცვლილებები.
- `scripts/brand-discovery-worker.mts` — ახალი worker ბიუჯეტები.
- `tests/model-runtime.test.mts`, `tests/weekly-planning.integration.test.mts` — retry, ვადები, მოდელების განაწილება და ნაწილობრივი აღდგენა.
- `docs/Weekly Planning and Posts.md` და ეს ანგარიში — განახლებული ქცევა და გაშვების ინსტრუქცია.

## შემოწმება

`npm run check`, `npm run test:planning` (19 ტესტი), `npm run test:discovery` (6 ტესტი), `npm run lint` და `npm run build`. Lint-ში დარჩა მხოლოდ 5 არსებული გაფრთხილება golden ტესტებში. ტესტები იყენებს გამოგონილ HTTP პასუხებს და იზოლირებულ დროებით PostgreSQL სქემებს; რეალური გენერაციის ხარჯი არ წარმოქმნილა. lease-ის დაცვა შემოწმებულია ყველაზე ხანგრძლივი ნებადართული ცდის შემდეგ დარჩენილი ვადის სიმულაციით.

ოფიციალური წყაროები: [OpenAI-ის შეცდომების განმარტება](https://developers.openai.com/api/docs/guides/error-codes), [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra). კონკრეტული retry-ის ლიმიტები და ვადები ამ პროექტის ბრიფის მიხედვითაა არჩეული.
