export class ScheduleConflict extends Error {
  constructor(message: string) { super(message); this.name = "ScheduleConflict" }
}
export function scheduleErrorMessage(error: unknown) {
  if (error instanceof Error && /[ა-ჰ]/u.test(error.message)) return error.message
  const message = error instanceof Error ? error.message : ""
  if (/must change publishAt instant/iu.test(message)) return "არჩეული დრო უკვე შენახულია. მიუთითეთ სხვა დრო."
  if (/media|asset|Reel/iu.test(message)) return "გამოსაქვეყნებლად საჭირო მედია აკლია ან ეს ფორმატი ჯერ ვერ ქვეყნდება."
  if (/account|binding|Channel/iu.test(message)) return "არჩეული ანგარიში გათიშულია ან ამ არხზე გამოქვეყნება მიუწვდომელია. განაახლეთ კავშირი."
  if (/approval|approved|review|content|copy/iu.test(message)) return "კონტენტი ან მისი დამტკიცება შეიცვალა. განაახლეთ გვერდი და გადაამოწმეთ პოსტები."
  if (/time|publishAt|date/iu.test(message)) return "გამოქვეყნების დრო მომავალში უნდა იყოს. გადაამოწმეთ თარიღი და დროის სარტყელი."
  if (/access|Brand|not found/iu.test(message)) return "განრიგი ვერ მოიძებნა ან მასზე წვდომა არ გაქვთ."
  return "განრიგი ვერ შეინახა. გადაამოწმეთ არჩეული პოსტები, ანგარიშები და დროები."
}
