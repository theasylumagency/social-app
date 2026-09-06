const {
    TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT,
} = require(
    "./total-charm-dent.content-direction.fixture.cjs",
)

const TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-experiment-decision-v1",

        locale:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.locale,

        weeklyObjective:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.weeklyObjective,

        weeklyAudienceFocus:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.weeklyAudienceFocus,

        communicationEnvelope:
            TOTAL_CHARM_DENT_CONTENT_DIRECTION_INPUT.communicationEnvelope,

        contentDirections: [
            {
                contentDirectionKey: "d1",

                direction:
                    "განმარტეთ, რა კითხვებს პასუხობს სრულფასოვანი დიაგნოსტიკა რთული მკურნალობის არჩევამდე და რომელი საკითხები რჩება ინდივიდუალური შეფასების საგნად.",

                purpose:
                    "გაურკვევლობა გარდაიქმნას კონკრეტულ კლინიკურ კითხვებად, რომლებზეც მკურნალობის გეგმა უნდა პასუხობდეს.",
            },

            {
                contentDirectionKey: "d2",

                direction:
                    "აჩვენეთ, როგორ ერთიანდება სხვადასხვა სპეციალისტის შეფასება შეთანხმებულ მრავალპროფილურ გეგმაში.",

                purpose:
                    "გასაგები გახდეს მრავალპროფილური კოორდინაციის როლი რთული მკურნალობის დაგეგმვაში.",
            },

            {
                contentDirectionKey: "d3",

                direction:
                    "განმარტეთ, როგორ ფასდება და შედარდება მკურნალობის შესაძლო ვარიანტები, მათი შეზღუდვები და კომპრომისები ინდივიდუალურ რეკომენდაციამდე.",

                purpose:
                    "მკურნალობის არჩევანი აღქმული იყოს დასაბუთებულ გადაწყვეტილებად და არა ერთადერთ აუხსნელ პასუხად.",
            },

            {
                contentDirectionKey: "d4",

                direction:
                    "გაამარტივეთ გზა დიაგნოსტიკიდან შეთანხმებულ მკურნალობის გეგმამდე: რა თანმიმდევრობით ზუსტდება პრიორიტეტები, ეტაპები და შემდეგი ნაბიჯები.",

                purpose:
                    "ადამიანმა გაიგოს, როგორ ყალიბდება მოქმედების გასაგები გზა სრული ინფორმაციის საფუძველზე.",
            },
        ],

        contentAudienceDirections: [
            {
                contentDirectionKey: "d1",
                primaryAudienceKey: "a1",
                secondaryAudienceKeys: [
                    "a2",
                ],
                bias: "moreExplanatory",
            },

            {
                contentDirectionKey: "d2",
                primaryAudienceKey: "a2",
                secondaryAudienceKeys: [],
                bias: "moreTrustFocused",
            },

            {
                contentDirectionKey: "d3",
                primaryAudienceKey: "a2",
                secondaryAudienceKeys: [
                    "a1",
                ],
                bias: "moreDecisionOriented",
            },

            {
                contentDirectionKey: "d4",
                primaryAudienceKey: "a1",
                secondaryAudienceKeys: [
                    "a2",
                ],
                bias: "moreExplanatory",
            },
        ],

        priorResults: [],

        recentSignals: [],

        priorExperiments: [],

        constraints: [
            "არ გამოიყენო ხელოვნური გადაუდებლობა.",
            "არ გამოიყენო გარანტირებული შედეგების დაპირება.",
            "არ შეცვალო Brand Voice ექსპერიმენტის გამო.",
            "არ გამოიყენო დაუდასტურებელი proof.",
        ],
    })

module.exports = {
    TOTAL_CHARM_DENT_EXPERIMENT_DECISION_INPUT,
}