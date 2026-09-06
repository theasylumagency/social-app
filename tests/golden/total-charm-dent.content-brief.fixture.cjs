const {
    TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
} = require(
    "./total-charm-dent.content-direction.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-brief-v1",

        locale:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.locale,

        weeklyObjective:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.weeklyObjective,

        weeklyAudienceFocus:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.weeklyAudienceFocus,

        communicationEnvelope:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.communicationEnvelope,

        selectedContentDirection: {
            contentDirectionKey:
                "d1",

            direction:
                "განმარტეთ, რა კითხვებს პასუხობს სრულფასოვანი დიაგნოსტიკა რთული მკურნალობის არჩევამდე და რომელი საკითხები რჩება ინდივიდუალური შეფასების საგნად.",

            purpose:
                "გაურკვევლობა გარდაიქმნას კონკრეტულ კლინიკურ კითხვებად, რომლებზეც მკურნალობის გეგმა უნდა პასუხობდეს.",

            rationale:
                "ეს ქმნის კვირის მთავარ საფუძველს: შესაძლო მოქმედებამდე აჩვენებს შეფასების საჭიროებას და არ ტოვებს წინასწარი დიაგნოზის შთაბეჭდილებას.",
        },

        contentAudienceDirection: {
            primaryAudienceKey:
                "a1",

            secondaryAudienceKeys: [
                "a2",
            ],

            bias:
                "moreExplanatory",
        },

        brandKnowledge: {
            positioning: [
                "მრავალპროფილური სტომატოლოგიური კლინიკა",
                "დიაგნოსტიკა და დაგეგმვა მკურნალობის მნიშვნელოვანი ნაწილია",
            ],

            voice: [
                "მშვიდი",
                "პროფესიონალური",
                "არასაჭარბო",
                "გასაგები",
            ],
        },

        businessFacts: [
            {
                factKey:
                    "bf-location",

                statement:
                    "კლინიკა მდებარეობს ვაკეში, თბილისში.",
            },

            {
                factKey:
                    "bf-multidisciplinary",

                statement:
                    "კლინიკაში სხვადასხვა პროფილის სტომატოლოგები მუშაობენ.",
            },

            {
                factKey:
                    "bf-diagnostics",

                statement:
                    "დიაგნოსტიკა და მკურნალობის დაგეგმვა კლინიკის სამუშაო პროცესის ნაწილია.",
            },
        ],

        evidence: [],

        constraints: [
            "არ შექმნა წინასწარი დიაგნოზის შთაბეჭდილება.",
            "არ დაპირდე შედეგს.",
            "არ გამოიყენო ხელოვნური გადაუდებლობა.",
            "არ წარმოაჩინო ტექნოლოგია გარანტიის წყაროდ.",
        ],
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT,
}