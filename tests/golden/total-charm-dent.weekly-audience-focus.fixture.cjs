const {
    TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
} = require(
    "./total-charm-dent.communication-envelope.fixture.cjs",
)

const TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-weekly-audience-focus-v1",

        locale:
            TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT.locale,

        weeklyObjective: {
            statement:
                "გაზარდოს ნდობა იმ პერსპექტიულ პაციენტებში, რომლებიც გაურკვეველი ან რთული მკურნალობის გადაწყვეტილების წინაშე დგანან, კლინიკის შეფასებისა და მკურნალობის დაგეგმვის პროცესის უფრო გასაგებად წარმოჩენით.",

            rationale:
                "ამ კვირაში მთავარი პროგრესი არის გადაწყვეტილების გაურკვევლობის შემცირება და პროფესიული დაგეგმვის მიმართ ნდობის გაძლიერება.",
        },

        audiences:
            TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT.profiles,

        communicationEnvelope: {
            complexity:
                "technicalWhenExplained",

            assumedKnowledge:
                "none",

            explanationDepth:
                "balanced",

            ctaStyle:
                "consultative",

            salesPressure:
                "low",

            framingRules: [
                "ჯერ ახსენით შეფასების ან დიაგნოსტიკის საჭიროება და შემდეგ შესაძლო მოქმედება.",
                "მკაფიოდ განასხვავეთ ზოგადი ინფორმაცია, შეფასებით დასადგენი გარემოებები და ინდივიდუალური რეკომენდაცია.",
                "რეკომენდაციისას ახსენით კლინიკური ლოგიკა, შესაძლო ალტერნატივები და შეზღუდვები.",
            ],

            trustMechanisms: [
                "პროცესისა და ეტაპების სიცხადე",
                "პროფესიული ახსნა",
                "ვარიანტებისა და შეზღუდვების გამჭვირვალე შედარება",
                "სპეციფიკურობა დაუდასტურებელი დაპირებების გარეშე",
            ],

            avoid: [
                "წინასწარი დიაგნოზის შთაბეჭდილება",
                "გარანტირებული შედეგები",
                "უსაფუძვლო უპირატესობის მტკიცება",
                "ზეწოლაზე დაფუძნებული მოწოდებები",
            ],
        },

        priorSignals: [],
    })

module.exports = {
    TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT,
}