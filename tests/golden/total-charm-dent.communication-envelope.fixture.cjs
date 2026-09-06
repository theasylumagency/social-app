const {
    TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT,
} = require(
    "./total-charm-dent.communication-profile.fixture.cjs",
)

const TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-communication-envelope-v1",

        locale:
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT.locale,

        brandVoice:
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT.brandVoice,

        positioning:
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT.positioning,

        constraints:
            TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT.constraints,

        profiles: [
            {
                audienceKey: "a1",
                influence: "standard",

                communicationGoal:
                    "დაეხმაროს პაციენტს არსებული პრობლემის პროფესიული შეფასების, დიაგნოსტიკის მიზნისა და შესაძლო შემდეგი ნაბიჯების გასაგებად აღქმაში, მკურნალობის წინასწარ განსაზღვრის გარეშე.",

                assumedKnowledge: "none",
                explanationDepth: "balanced",
                ctaStyle: "consultative",

                toneAdjustments: [
                    "მშვიდი",
                    "კომპეტენტური",
                    "გასაგები",
                ],

                preferredFraming: [
                    "პრობლემის მიზეზის პროფესიული შეფასება",
                    "დიაგნოსტიკა → შესაძლო მკურნალობის გზა",
                    "ეტაპების გასაგები ახსნა",
                ],

                trustMechanisms: [
                    "პროცესის სიცხადე",
                    "პროფესიული ახსნა",
                    "შეზღუდვების გამჭვირვალე აღნიშვნა",
                ],

                avoid: [
                    "წინასწარი დიაგნოზი",
                    "გარანტირებული შედეგები",
                    "ზეწოლა",
                ],
            },

            {
                audienceKey: "a2",
                influence: "standard",

                communicationGoal:
                    "მისცეს პაციენტს კლინიკური მიდგომის, დიაგნოსტიკური და ციფრული შესაძლებლობების, მკურნალობის ვარიანტებისა და რეკომენდაციის დასაბუთებულად შედარებისთვის საჭირო ინფორმაცია.",

                assumedKnowledge: "basic",
                explanationDepth: "deep",
                ctaStyle: "directWhenJustified",

                toneAdjustments: [
                    "მშვიდი",
                    "კომპეტენტური",
                    "თავშეკავებულად თავდაჯერებული",
                ],

                preferredFraming: [
                    "რეკომენდაციის კლინიკური დასაბუთება",
                    "ალტერნატივების შედარება",
                    "მრავალდისციპლინური კოორდინაცია",
                ],

                trustMechanisms: [
                    "კლინიკური დასაბუთება",
                    "სპეციფიკური ახსნა",
                    "ალტერნატივების გამჭვირვალე შედარება",
                ],

                avoid: [
                    "უსაფუძვლო უპირატესობის მტკიცება",
                    "კონკურენტების დაკნინება",
                    "ტექნოლოგიის შედეგის გარანტიად წარმოჩენა",
                ],
            },

            {
                audienceKey: "a3",
                influence: "standard",

                communicationGoal:
                    "შეინარჩუნოს მკურნალობის უწყვეტობა და პაციენტისთვის მკაფიო გახადოს მიმდინარე მდგომარეობა, შემდეგი ეტაპი და სხვადასხვა სპეციალისტის როლი.",

                assumedKnowledge: "informed",
                explanationDepth: "balanced",
                ctaStyle: "directWhenJustified",

                toneAdjustments: [
                    "მშვიდი",
                    "მკაფიო",
                    "თანმიმდევრული",
                ],

                preferredFraming: [
                    "მიმდინარე ეტაპი → საერთო გეგმა",
                    "დასრულებული → მიმდინარე → შემდეგი",
                    "სპეციალისტების კოორდინირებული ჩართულობა",
                ],

                trustMechanisms: [
                    "უწყვეტობა",
                    "შემდეგი ნაბიჯების სიცხადე",
                    "კოორდინაციის გამჭვირვალობა",
                ],

                avoid: [
                    "შემდეგი ნაბიჯის გაურკვევლობა",
                    "ფრაგმენტული კომუნიკაცია",
                    "მიმდინარე ეტაპისგან მოწყვეტილი გაყიდვა",
                ],
            },
        ],
    })

module.exports = {
    TOTAL_CHARM_DENT_COMMUNICATION_ENVELOPE_INPUT,
}