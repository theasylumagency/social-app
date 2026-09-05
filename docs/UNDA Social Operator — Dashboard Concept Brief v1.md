# UNDA Social Operator — Dashboard Concept Brief v1

## 0. Purpose

ეს დოკუმენტი განსაზღვრავს UNDA Social Operator-ის ძირითად authenticated product experience-ს:

```text
Authentication
→ Brand setup / resume
→ Weekly workspace
→ Content
→ Results
→ Brand
→ Connections / Settings
```

Dashboard-ის მიზანი არ არის მომხმარებლისთვის ბევრი მონაცემის ჩვენება.

მისი მიზანია მომხმარებელმა ნებისმიერ მომენტში სწრაფად გაიგოს:

```text
რა ხდება ახლა?
რამე მჭირდება მე?
რას აკეთებს Operator?
რა მოხდება შემდეგ?
```

Social Operator უნდა აღიქმებოდეს როგორც მაღალკვალიფიციური მენეჯერი, რომელიც მართავს სოციალურ კომუნიკაციას უწყვეტ ციკლად:

```text
Understand
→ Plan
→ Create
→ Review
→ Schedule
→ Publish
→ Learn
→ Next Cycle
```

---

# 1. Core Product Principle

UNDA არ არის:

```text
content generator
post scheduler
analytics dashboard
social media toolbox
```

UNDA არის:

> სოციალური კომუნიკაციის ოპერატორი, რომელიც არსებული ცოდნის, მიმდინარე მიზნების და მიღებული შედეგების საფუძველზე იღებს შემდეგ სწორ გადაწყვეტილებას.

Dashboard უნდა გამოხატავდეს სწორედ ამ ლოგიკას.

---

# 2. Authentication Entry

მომხმარებელი ავტორიზდება:

```text
Google
or
Email / Password
```

ავტორიზაციის შემდეგ სისტემა არ აჩვენებს operator selector-ს, სანამ მხოლოდ Social Operator არის ხელმისაწვდომი.

მომხმარებელი პირდაპირ შედის Social Operator-ის სამუშაო გარემოში.

---

# 3. Post-Authentication Routing

ავტორიზაციის შემდეგ სისტემა ამოწმებს:

```text
1. აქვს თუ არა მომხმარებელს accessible workspace
2. არსებობს თუ არა ბრენდი
3. დასრულებულია თუ არა brand setup
4. შესაძლებელია თუ არა მიმდინარე Social workflow
5. რომელ ბრენდზე მუშაობდა მომხმარებელი ბოლოს
```

Canonical routing:

```text
Login
→ Last accessible brand

Brand setup incomplete?
├─ Yes → Resume Brand Setup
└─ No  → Weekly Workspace
```

თუ რამდენიმე ბრენდია:

```text
return to last accessible brand
```

თუ ბოლო ბრენდი აღარ არის აქტიური ან ხელმისაწვდომი:

```text
open first accessible brand
```

---

# 4. First Brand Setup

თუ ბრენდი ჯერ არ არის მზად სამუშაოდ, მომხმარებელი აგრძელებს onboarding-ს.

Source-first flow:

```text
Website
→ analysis
→ editable extracted information
→ additional sources
→ confirmation
→ Brand Brain readiness
```

შემდგომში სოციალური ანგარიშებიც უნდა გამოიყენებდეს იგივე source-oriented ingestion philosophy-ს.

Setup-ის მიზანი არ არის სრულყოფილი Brand Brain-ის შექმნა.

მიზანია Minimum Viable Brand Knowledge, რომლის შემდეგაც Operator უკვე უსაფრთხოდ და სასარგებლოდ მუშაობს.

Unknown ინფორმაცია ავტომატურად არ უნდა გახდეს blocker.

---

# 5. Successful Setup → Operator Workspace

როგორც კი პირველადი setup დასრულებულია და Brand Brain-ს მუშაობისთვის საკმარისი ინფორმაცია აქვს:

```text
Brand Setup
→ Weekly Workspace
```

ეს მომენტი ასევე წარმოადგენს Trial-ის დაწყების ბუნებრივ წერტილს.

Registration თავისთავად Trial-ის დაწყება არ არის.

---

# 6. Main Navigation

Initial Social Operator navigation:

```text
კვირა
კონტენტი
შედეგები
ბრენდი

────────────

კავშირები
პარამეტრები
```

არ არსებობს ცალკე:

```text
Dashboard
Home
Analytics
Calendar
Notifications
```

როგორც top-level tabs.

---

# 7. Week = Dashboard

`კვირა` არის Social Operator-ის მთავარი სამუშაო სივრცე.

ეს არის default screen ავტორიზაციის შემდეგ, თუ brand setup დასრულებულია.

მთავარი პრინციპი:

> მომხმარებელი ხედავს მიმდინარე სამუშაო ციკლს და არა აბსტრაქტულ სტატისტიკურ dashboard-ს.

Week page პირველივე ეკრანზე პასუხობს:

```text
რა მდგომარეობაში ვართ?
რა არის ამ კვირის მიზანი?
რა კეთდება ახლა?
რა არის შემდეგი?
არის თუ არა ჩემი ჩარევა საჭირო?
```

---

# 8. Week — Primary Status

Week page-ის ყველაზე მნიშვნელოვანი ელემენტია Operator Status.

მაგალითები:

### On Track

```text
ყველაფერი რიგზეა

შემდეგი პოსტი გამოქვეყნდება
ორშაბათს, 11:30-ზე.
```

### Needs Attention

```text
თქვენი გადაწყვეტილებაა საჭირო

ამ კვირის გეგმა მზადაა.
4 პოსტიდან 1 საჭიროებს თქვენს განხილვას.

[გეგმის ნახვა]
```

### Operator Working

```text
Operator მუშაობს

ვამზადებთ შემდეგი კვირის გეგმას.
```

### First Cycle

```text
ბრენდი მზადაა სამუშაოდ

წყაროები გაანალიზებულია.
Operator ამზადებს პირველ კვირის გეგმას.
```

### Access Paused

```text
Operator-ის მუშაობა შეჩერებულია

თქვენი მასალა და ბრენდის ინფორმაცია შენახულია.
მუშაობის გასაგრძელებლად საჭიროა აქტიური ტარიფი.

[ტარიფის არჩევა]
```

---

# 9. Week — Weekly Objective

ყოველ კვირას უნდა ჰქონდეს მკაფიო მიზანი.

მაგალითად:

```text
ამ კვირის მიზანი

კერამიკული ვინირების მომსახურების
ცნობადობის გაზრდა იმ აუდიტორიაში,
რომელიც უკვე განიხილავს ესთეტიკურ მკურნალობას.
```

Goal არ უნდა იყოს უბრალოდ:

```text
engagement increase
more followers
post consistently
```

თუ ეს არ არის კონკრეტულად დასაბუთებული ბიზნეს ან კომუნიკაციური ამოცანა.

---

# 10. Week — Management Rationale

Weekly Plan უნდა ხსნიდეს არა მხოლოდ რას ვაკეთებთ, არამედ რატომ.

მაგალითად:

```text
რატომ ეს მიმართულება?

ბოლო კვირებში საგანმანათლებლო კონტენტს
უფრო მაღალი შენახვის მაჩვენებელი ჰქონდა,
ხოლო პირდაპირ შეთავაზებებს — სუსტი რეაქცია.

ამ კვირაში საგანმანათლებლო ფორმატის წილს ვზრდით.
```

მომხმარებელს არ სჭირდება full chain-of-thought.

სჭირდება გადაწყვეტილების საკმარისი managerial rationale.

---

# 11. Week — Workflow View

Current week should expose the operational flow:

```text
გეგმა
→ მომზადება
→ განხილვა
→ დაგეგმვა
→ გამოქვეყნება
```

მაგალითად:

```text
გეგმა            ✓
კონტენტი         4
დამტკიცებული     3
დაგეგმილი        3
საჭიროა თქვენგან 1
```

მაგრამ presentation არ უნდა გადაიქცეს generic KPI card grid-ად.

ეს არის workflow status.

---

# 12. Week — Content List

Week page აჩვენებს მიმდინარე კვირის ძირითად პოსტებს.

მაგალითი:

```text
ორშ · 11:30
Instagram + Facebook

რატომ არ ნიშნავს იაფი ყოველთვის ეკონომიურს

✓ დამტკიცებულია
✓ დაგეგმილია
```

```text
ოთხ · 18:00
Instagram

3 რამ, რასაც მომხმარებელი არჩევისას ყურადღებას აქცევს

● საჭიროა განხილვა
```

```text
პარ · 12:00
Facebook

რას ნიშნავს ხარისხიანი კონსულტაცია

○ მზადდება
```

---

# 13. Week — Attention Queue

User-facing attention must be exceptional.

მთავარი წესი:

> მომხმარებელს მხოლოდ ის უნდა ვთხოვოთ, რაც Operator დამოუკიდებლად სწორად ვერ გადაწყვეტს.

Examples:

```text
გეგმის დამტკიცება
```

```text
პოსტის მნიშვნელოვანი factual ცვლილების დადასტურება
```

```text
Facebook კავშირის აღდგენა
```

```text
ახალი ინფორმაციის დაზუსტება,
რომელიც მნიშვნელოვან existing claim-ს ეწინააღმდეგება
```

არ უნდა შეიქმნას questionnaire per unknown.

---

# 14. No Mandatory Analysis Ceremony

Analysis არ არის weekly ritual.

Operator არ უნდა აიძულებდეს მომხმარებელს ყოველ კვირას:

```text
Read analysis
→ Confirm
→ Continue
```

თუ მნიშვნელოვანი ახალი დასკვნა არ არსებობს, Operator უბრალოდ იყენებს მიღებულ ცოდნას შემდეგ გადაწყვეტილებაში.

თუ მნიშვნელოვანი ცვლილებაა:

```text
ამ კვირის გეგმაში ერთი მიმართულება შევცვალეთ.

რატომ:
ბოლო ოთხ ციკლში X ფორმატმა
სტაბილურად სუსტი შედეგი აჩვენა.

[დეტალები]
```

---

# 15. Content Tab

`კონტენტი` წარმოადგენს Social Operator-ის content workspace-ს.

იგი მოიცავს:

```text
Needs Review
Approved
Scheduled
Published
Drafts
```

შესაძლო views:

```text
List
Calendar
```

Calendar არ არის დამოუკიდებელი top-level tab.

---

# 16. Content Item

ყოველ content item-ს უნდა ჰქონდეს მინიმუმ:

```text
channel
format
content mode
planned publish time
status
goal / role in weekly plan
draft
media
review state
publishing state
result when available
```

მომხმარებელს უნდა შეეძლოს კონკრეტული პოსტიდან დაინახოს:

```text
რატომ შეიქმნა?
რა ეტაპზეა?
როდის გამოქვეყნდება?
რა შედეგი მიიღო?
```

---

# 17. Results Tab

`შედეგები` პასუხობს:

```text
რა გავაკეთეთ?
რა მოხდა?
რა ვისწავლეთ?
რას შევცვლით?
```

ეს არ არის მხოლოდ analytics dashboard.

---

# 18. Results — Overview

Default period შეიძლება იყოს:

```text
Last 30 Days
```

Overview შეიძლება აჩვენებდეს:

```text
გამოქვეყნებული პოსტები
Reach / Views
Engagement
Audience Growth
Saves
Shares
Clicks
```

მაგრამ მხოლოდ ის metrics, რომლებიც რეალურად ხელმისაწვდომია connected channels-იდან.

---

# 19. Metrics Require Context

High number ≠ success.

Operator არ ამბობს:

```text
ამ პოსტს 100 share ჰქონდა — შესანიშნავია.
```

ის აფასებს:

```text
რა იყო პოსტის მიზანი?
შეასრულა თუ არა?
იყო თუ არა მიღებული აუდიტორია სასარგებლო?
არის თუ არა შედეგი განმეორებადი?
```

მაგალითად:

```text
ამ პოსტმა ყველაზე მაღალი reach მიიღო,
მაგრამ engagement საშუალოზე დაბალი იყო.

Awareness მიზნისთვის შედეგი ძლიერია.
Consideration მიზნისთვის — საშუალო.
```

---

# 20. Results — Content Performance

Results-ში შესაძლებელი უნდა იყოს individual content comparison.

Example:

```text
3 შეცდომა არჩევისას
Instagram + Facebook

Reach        8.2K
Engagement   6.1%
Saves        მაღალი

შეფასება:
ძლიერი
```

შეფასებები გამოიყენება semantic bands-ით:

```text
ძლიერი
ნორმალური
სუსტი
```

არ გამოიყენება fake precision:

```text
82/100
93% content quality
```

თუ ასეთი score რეალურად არ ასახავს measurement model-ს.

---

# 21. Results — What Operator Learned

ეს არის Results tab-ის ერთ-ერთი მთავარი ნაწილი.

Example:

```text
რას ვსწავლობთ

პრაქტიკულ საგანმანათლებლო პოსტებს
ბოლო რამდენიმე კვირაში სტაბილურად
უფრო მაღალი Save rate აქვს.

Instagram-ზე carousel ფორმატი
ამ ეტაპზე უკეთ მუშაობს,
ვიდრე static posts.

პირდაპირი შეთავაზებების გაზრდამ
engagement არ გააუმჯობესა.
```

სწავლა უნდა იყოს:

```text
evidence-aware
falsifiable
contextual
revisable
```

ერთი პოსტი არ ქმნის rule-ს.

---

# 22. Results — What Changes Next

Analytics უნდა იხურებოდეს decision-ში.

Example:

```text
შემდეგ ციკლში შევცვლით

↑ საგანმანათლებლო კონტენტის წილი
↓ პირდაპირი შეთავაზებების რაოდენობა
→ carousel ფორმატის კიდევ ერთი ტესტი
```

ეს არის:

```text
Results
→ Learn
→ Next Weekly Cycle
```

---

# 23. Results — Initial Baseline

თუ Social account დაკავშირებისას უკვე არსებობს ისტორიული მონაცემი:

```text
Facebook
Instagram
```

Operator-ს შეუძლია შექმნას:

```text
საწყისი მდგომარეობის ანალიზი
```

მაგალითად:

```text
გაანალიზებულია ბოლო 90 დღე
84 პოსტი
```

ეს შეიძლება გახდეს baseline მომავალი comparison-ისთვის.

თუ ისტორიული performance data არ არსებობს:

```text
შედეგები ჯერ არ დაგროვებულა.

პირველი პოსტების გამოქვეყნების შემდეგ
აქ გამოჩნდება შედეგები,
Operator-ის დასკვნები და ცვლილებები.
```

Results tab ცარიელი dashboard-ით არ უნდა დაგვხვდეს.

---

# 24. Brand Tab

`ბრენდი` არის Brand Knowledge-ის user-facing workspace.

ის პასუხობს ოთხ კითხვას:

```text
რას ვიცით?
საიდან ვიცით?
რა შეიცვალა?
რა შეგიძლია დაამატო?
```

---

# 25. Brand — Current Knowledge

Brand tab აჩვენებს მიმდინარე usable knowledge-ს ადამიანურად.

Possible domains:

```text
ბრენდის იდენტობა
რას ვთავაზობთ
აუდიტორია
პოზიციონირება
ხმა და სტილი
კონტენტის მიმართულებები
შეზღუდვები
```

მაგალითი:

```text
ტონი

პროფესიული, მშვიდი,
არაგაყიდვითი.

წყარო:
Website + Facebook

✓ დადასტურებულია თქვენ მიერ
```

ან:

```text
აუდიტორია

30–50 წლის ადამიანები,
რომლებიც ხარისხს და კომფორტს
ანიჭებენ უპირატესობას.

Operator-ის დასკვნაა არსებული კონტენტიდან.

[დაზუსტება]
```

---

# 26. Brand — Refinement, Not CMS Editing

ყველა field-ს არ უნდა ეწეროს:

```text
Edit
```

სასურველი language:

```text
დაზუსტება
დამატება
შესწორება
დადასტურება
```

Brand Brain არის evolving knowledge system და არა static CMS profile.

---

# 27. Brand — Add Information

მომხმარებელს უნდა შეეძლოს პირდაპირ უთხრას Operator-ს ახალი ინფორმაცია.

Example:

```text
უთხარი Operator-ს რამე ბრენდზე
```

Free text:

```text
ჩვენ აღარ გვინდა სიტყვა „იაფი“
გამოვიყენოთ კომუნიკაციაში.
```

ან:

```text
ოქტომბრიდან ახალი მომსახურება გვემატება.
```

სისტემა interpret-ავს ინფორმაციას და საჭიროების შემთხვევაში აჩვენებს:

```text
რა შეიცვლება?
```

before authoritative mutation.

---

# 28. Brand — Structured Additions

ასევე შესაძლებელია structured paths:

```text
+ მომსახურება
+ აუდიტორია
+ საკომუნიკაციო წესი
+ კონტენტის მიმართულება
+ ბიზნეს ინფორმაცია
+ წყარო
```

---

# 29. Brand — Sources

Brand tab შეიცავს Sources view-ს.

Examples:

```text
Website
https://example.com

პირველად გაანალიზდა:
5 სექტემბერი 2026

ბოლოს შემოწმდა:
12 სექტემბერი 2026

✓ აქტიური
```

```text
Facebook Page

პირველად გაანალიზდა:
5 სექტემბერი 2026

ბოლოს შემოწმდა:
12 სექტემბერი 2026

✓ აქტიური
```

Possible states:

```text
Active
Needs Reconnection
Unavailable
Changed
Never Refreshed
```

---

# 30. Brand — Add Source

Possible future sources:

```text
Website URL
Facebook
Instagram
PDF
Brand Guidelines
Presentation
Text Document
Other structured source
```

Source addition უნდა იწვევდეს knowledge acquisition workflow-ს.

არა პირდაპირ uncontrolled Brand Brain mutation-ს.

---

# 31. Brand — Change History

Brand tab აჩვენებს meaningful semantic history-ს.

Example:

```text
12 სექტემბერი

ვებსაიტი ხელახლა შემოწმდა.
დაემატა ახალი მომსახურება:
კერამიკული ვინირები.
```

```text
9 სექტემბერი

თქვენი პასუხის საფუძველზე
დაზუსტდა კომუნიკაციის ტონი.
```

```text
5 სექტემბერი

შეიქმნა საწყისი Brand Brain.
წყაროები:
Website + Facebook.
```

არ ვაჩვენებთ:

```text
EvidenceRouting recomputed
confidence changed 0.73 → 0.76
mutation reducer completed
```

---

# 32. Brand Knowledge ≠ Business Facts

UX-ში Brand page შეიძლება აერთიანებდეს რამდენიმე ტიპის ინფორმაციას.

მაგრამ architecture-ში ცალკე რჩება:

```text
Brand Knowledge
Business Facts
Proof
Learned Preferences
Operator Defaults
```

მაგალითად:

```text
opening hours
phone
price
availability
```

არ არის strategic Brand Brain knowledge.

მაგრამ user-facing Brand workspace-ში შეიძლება იყოს შესაბამისი Business Information section.

---

# 33. Connections

`კავშირები` შეიცავს external accounts-ს და data sources-ს, რომლებიც operational access-ს მოითხოვს.

Examples:

```text
Facebook
Instagram
Website
```

States:

```text
Connected
Needs Reconnection
Permission Missing
Disconnected
```

ამ გვერდზე იმართება connection-level controls.

Brand > Sources უფრო მეტად პასუხობს:

```text
რა წყაროებიდან სწავლობს Operator?
```

Connections პასუხობს:

```text
რომელ external systems-ზე აქვს ტექნიკური წვდომა?
```

---

# 34. Settings

`პარამეტრები` მოიცავს:

```text
Workspace
Account
Plan
Billing
Language
Operator preferences where appropriate
```

Brand-specific knowledge აქ არ უნდა გადავიტანოთ.

---

# 35. Shared Top Bar

Initial top bar:

```text
UNDA Social
[Brand ▼]

Trial · 11 days
[Account]
```

Future:

```text
UNDA
[Operator ▼]
[Brand ▼]

Plan / Trial
[Account]
```

---

# 36. Brand Switcher

Brand switcher აჩვენებს:

```text
Brand name
current brand usage
Add brand
```

Example:

```text
Total Charm

──────────

ბრენდები: 2 / 3

+ ბრენდის დამატება
```

თუ plan limit მიღწეულია:

```text
+ ბრენდის დამატება
Upgrade required
```

Existing brand data არ იშლება plan downgrade-ისას.

---

# 37. Trial Status

Trial information უნდა იყოს unobtrusive.

Example:

```text
საცდელი პერიოდი · დარჩა 11 დღე
ტარიფის არჩევა
```

არ უნდა არსებობდეს მუდმივი aggressive upgrade banner.

---

# 38. Trial Capability

Trial permits full Social workflow except:

```text
AI image generation
```

User image upload remains allowed.

Image generation action შეიძლება დარჩეს visible:

```text
AI სურათის გენერირება
ხელმისაწვდომია ფასიან ტარიფზე
```

---

# 39. Trial Expiry

After expiry:

User can still:

```text
sign in
view brands
view content
view results
view history
manage plan
```

Blocked:

```text
new generation
content mutation
automatic operator work
publishing
scheduled publishing
```

Dashboard clearly explains:

```text
თქვენი მასალა შენახულია.
Operator-ის მუშაობის გასაგრძელებლად
აირჩიეთ ტარიფი.
```

---

# 40. Notification / System Attention Center

System information არ არის top-level navigation tab.

იგი უნდა არსებობდეს compact attention/notification surface-ად.

Examples:

```text
Facebook connection expired
```

```text
Scheduled post failed
```

```text
Trial expires in 4 days
```

```text
Brand Brain detected a meaningful change
```

```text
Your decision is required
```

Only meaningful issues create visible attention.

Background system activity does not.

---

# 41. Notification Principle

User-visible warnings are expensive.

Do not notify about:

```text
routine refresh
successful background job
minor confidence adjustment
internal evidence changes
technical orchestration steps
```

Notify when:

```text
user action is required
publishing is affected
meaningful brand knowledge changed
access changed
important workflow failed
```

---

# 42. Operator Activity

Week page შეიძლება აჩვენებდეს lightweight recent activity.

Example:

```text
ბოლო მოქმედებები

12:42
შემდეგი კვირის გეგმა მომზადდა

გუშინ
თქვენ დაამტკიცეთ პოსტი

გუშინ
პოსტი გამოქვეყნდა Facebook-ზე
```

ეს არის human-readable operator activity.

არა raw audit log.

---

# 43. Main Empty-State Principle

Social Operator-ში არ უნდა არსებობდეს generic empty dashboard.

Each empty state must explain:

```text
Where are we?
Why is there no content?
What happens next?
```

Examples:

### No results yet

```text
შედეგები ჯერ არ დაგროვებულა.

პირველი პოსტების გამოქვეყნების შემდეგ
აქ გამოჩნდება შედეგები და Operator-ის დასკვნები.
```

### No weekly plan yet

```text
Operator ამზადებს პირველ გეგმას.
```

### No connected social account

```text
კონტენტის მომზადება შეგვიძლია,
მაგრამ გამოქვეყნებისთვის საჭიროა
Facebook ან Instagram-ის დაკავშირება.
```

---

# 44. Managerial Product Behavior

Dashboard ყოველთვის უნდა გამოხატავდეს Management Principles-ს.

Operator:

```text
does not celebrate activity for its own sake
does not chase novelty without reason
does not treat one result as a rule
does not confuse reach with success
does not hide uncertainty
does not ask the user unnecessary questions
does not generate work merely to look busy
```

Operator should:

```text
set goals
make plans
explain important decisions
measure relevant outcomes
learn cautiously
adapt future actions
recommend doing less when appropriate
say “not yet” when evidence is insufficient
```

---

# 45. Dashboard Success Criterion

Successful Social Operator dashboard should create this user behavior:

Not:

> შევიდე და სოციალური ქსელები ვმართო.

Not:

> ვნახო რამდენი like დაგროვდა.

Not:

> მოვიფიქრო შემდეგი პოსტი.

But:

> შევხედო, როგორ მიდის საქმე და ხომ არ სჭირდება Operator-ს ჩემგან რამე.

---

# 46. Final Information Architecture

```text
AUTHENTICATION

↓


BRAND SETUP
only if incomplete

↓


SOCIAL OPERATOR

┌─────────────────────┐
│ კვირა               │ ← Default / Dashboard
│ კონტენტი            │
│ შედეგები            │
│ ბრენდი              │
│                     │
│ ──────────────────  │
│ კავშირები           │
│ პარამეტრები         │
└─────────────────────┘
```

System attention lives outside the primary navigation.

---

# 47. Core Product Loop Reflected in UI

The navigation maps directly to the product loop:

```text
BRAND
რას ვიცით

↓

WEEK
რას ვაპირებთ

↓

CONTENT
რას ვქმნით / ვაქვეყნებთ

↓

RESULTS
რა მოხდა / რა ვისწავლეთ

↓

NEXT WEEK
რას შევცვლით
```

ეს არის Social Operator-ის მთავარი UX მოდელი.

---

# 48. Final Rule

ნებისმიერი dashboard element-ის დამატებამდე უნდა დაისვას კითხვა:

> ეხმარება ეს მომხმარებელს გაარკვიოს რა ხდება, რა არის შემდეგი სწორი მოქმედება ან რა ისწავლა Operator-მა?

თუ არა, ის სავარაუდოდ dashboard-ზე არ გვჭირდება.