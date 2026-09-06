const {
    TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT,
} = require(
    "./total-charm-dent.weekly-objective.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-direction-v1",

        locale:
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT.locale,

        brandKnowledge:
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT.brandKnowledge,

        businessFacts:
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT.businessFacts,

        proof:
            TOTAL_CHARM_DENT_WEEKLY_OBJECTIVE_INPUT.proof,

        weeklyObjective: {
            objective:
                "რთული სტომატოლოგიური მკურნალობის წინ მყოფ აუდიტორიას გაუმარტივდეს იმის გაგება, როგორ ამცირებს სწორი დიაგნოსტიკა და მრავალპროფილური დაგეგმვა გაურკვევლობას მკურნალობის ვარიანტებსა და შემდეგ ნაბიჯებზე.",

            rationale:
                "ამ კვირის ფოკუსია გადაწყვეტილების სიცხადისა და პროფესიული დაგეგმვის მიმართ ნდობის გაძლიერება.",

            deliberateOmissions: [
                "ცალკეული ესთეტიკური სერვისების პრომოციულად წარმოჩენა.",
                "უკვე მიმდინარე მკურნალობაში მყოფი პაციენტებისთვის პროცესის უწყვეტობის მთავარ პრიორიტეტად ქცევა.",
                "ხელოვნური გადაუდებლობა ან გაყიდვითი ზეწოლა.",
            ],
        },

        weeklyAudienceFocus: {
            primaryAudienceKey: "a1",

            secondaryAudienceKeys: [
                "a2",
            ],

            rationale:
                "a1 ყველაზე პირდაპირ უკავშირდება გაურკვევლობის შემცირებას, ხოლო a2 მნიშვნელოვანია რთული ვარიანტების შედარებისა და რეკომენდაციის დასაბუთების კონტექსტში.",
        },

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
                "ჯერ ახსენით შეფასებისა და დიაგნოსტიკის საჭიროება და შემდეგ შესაძლო მოქმედება.",
                "მკაფიოდ განასხვავეთ ზოგადი ინფორმაცია და ინდივიდუალური რეკომენდაცია.",
                "რეკომენდაციისას ახსენით კლინიკური ლოგიკა, ალტერნატივები და შეზღუდვები.",
            ],

            trustMechanisms: [
                "პროცესისა და ეტაპების სიცხადე",
                "პროფესიული ახსნა",
                "ვარიანტებისა და შეზღუდვების გამჭვირვალე შედარება",
                "სპეციალისტების კოორდინაციის სიცხადე",
            ],

            avoid: [
                "წინასწარი დიაგნოზის შთაბეჭდილება",
                "გარანტირებული შედეგები",
                "უსაფუძვლო უპირატესობის მტკიცება",
                "ზეწოლაზე დაფუძნებული მოწოდებები",
            ],
        },

        priorContentDirections: [],

        recentResults: [],
        recentSignals: [],
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
}