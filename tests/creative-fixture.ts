import type { CreativeProposal, CreativeExploration, CreativeReview } from "../src/blueprints/social/creative/model"
export const creativeProposal = (): CreativeProposal => ({ directions: [
  ["ნივთის პასპორტი", "ნივთის ნიშნები მისი ისტორიის ნაწილებია", "წარმოსახვითი პასპორტის გვერდები გამოყოფს კვალს და დაზიანებას"],
  ["ფოტოს საზღვარს მიღმა", "კადრის გარეთ დარჩენილი დეტალი გადაწყვეტილებას ცვლის", "ახლო ხედისა და გამოტოვებული კონტექსტის ვიზუალური შეპირისპირება"],
  ["ორი მომავალი", "შეკეთება და ჩანაცვლება სხვადასხვა დანაკარგს გულისხმობს", "ნივთის ორი ჰიპოთეტური მომავლის პარალელური თხრობა"],
  ["ნაკაწრის ხმა", "ერთი კვალი სხვადასხვა მფლობელისთვის სხვადასხვა რამეს ნიშნავს", "წარმოსახვითი ნივთის პერსპექტივიდან დასმული კითხვა"],
].map(([title, coreThought, mechanism]) => ({ title: title!, coreThought: coreThought!, mechanism: mechanism!, whyAudienceCares: "ნივთის ისტორიასა და გამოსადეგობას შორის არჩევანი პირადია", manifestations: ["ერთი წარმოსახვითი ნივთით მოკლე ამბავი", "ორი ხედის შედარება ერთ ვიზუალში"], platforms: ["facebook", "instagram"] })) })
export const creativeFixture = (): CreativeExploration => ({ id: "test-exploration", input: { business: "ნივთების შეკეთების სახელოსნო", audiences: [{ name: "ნივთის მფლობელი", situation: "ირჩევს შეკეთებას ან ჩანაცვლებას" }], platforms: ["facebook", "instagram"] }, directions: creativeProposal().directions.map((d, i) => ({ ...d, key: `c${i + 1}` })) })
export const creativeReviewFixture = (keys = ["p1", "p2", "p3"]): CreativeReview => ({ posts: keys.flatMap(postKey => (["facebook", "instagram"] as const).map(channel => ({ postKey, channel, assessment: "acceptable", reason: "იდეის მექანიზმი შესრულებაში შენარჩუნებულია", repairDirection: "" }))) })
