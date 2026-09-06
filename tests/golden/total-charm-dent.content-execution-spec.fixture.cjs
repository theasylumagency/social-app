const {
    TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT,
} = require(
    "./total-charm-dent.content-brief.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-execution-spec-v1",

        locale:
            TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT.locale,

        weeklyObjective:
            TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT.weeklyObjective,

        communicationEnvelope:
            TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT.communicationEnvelope,

        contentAudienceDirection:
            TOTAL_CHARM_DENT_CONTENT_BRIEF_INPUT.contentAudienceDirection,

        contentBrief: {
            communicationJob:
                "აუდიტორიას დაეხმაროს, რთული სტომატოლოგიური მკურნალობის არჩევამდე არსებული გაურკვევლობა ჩამოაყალიბოს კონკრეტულ კითხვებად, რომლებზეც სრულფასოვანმა დიაგნოსტიკამ და მკურნალობის დაგეგმვამ უნდა უპასუხოს.",

            keyTakeaway:
                "სრულფასოვანი დიაგნოსტიკა მკურნალობის ვარიანტების, მათი კლინიკური ლოგიკის, შეზღუდვებისა და შესაძლო ეტაპების გარკვევის საფუძველია, თუმცა კონკრეტული რეკომენდაცია მხოლოდ ინდივიდუალური შეფასების შემდეგ განისაზღვრება.",

            supportingPoints: [
                "რომელი კლინიკური პრობლემა ან პრობლემების ერთობლიობა საჭიროებს მართვას.",
                "რა ფაქტორები ზღუდავს ან ცვლის შესაძლო მკურნალობის არჩევანს.",
                "რა ალტერნატივები შეიძლება განიხილებოდეს და როგორ უნდა შედარდეს მათი კლინიკური ლოგიკა და შეზღუდვები.",
                "რომელი საკითხები ვერ გადაწყდება ზოგადი ინფორმაციის საფუძველზე და ინდივიდუალურ შეფასებას საჭიროებს.",
            ],

            evidenceMode:
                "noProofNeeded",

            evidenceKeys: [],

            ctaIntent:
                "encourageReflection",

            constraints: [
                "ტექნიკური ტერმინები გამოყენებამდე განმარტდეს მარტივი ენით.",
                "ზოგადი განმარტება მკაფიოდ გაიმიჯნოს ინდივიდუალური რეკომენდაციისგან.",
                "შეფასებისა და დიაგნოსტიკის საჭიროება განხილული იყოს შესაძლო მოქმედებამდე.",
            ],

            mustNotSay: [
                "დიაგნოზის დადგენა შესაძლებელია ინდივიდუალური შეფასების გარეშე.",
                "არსებობს ერთი ყველასთვის სწორი მკურნალობის ვარიანტი.",
                "დიაგნოსტიკა შედეგის გარანტიას იძლევა.",
            ],
        },

        eligibleChannels: [
            "facebook",
            "instagram",
        ],

        eligibleContentModes: [
            "social.educational",
            "social.trustBuilder",
        ],

        channelPolicies: [
            {
                channel:
                    "facebook",

                supportedFormats: [
                    "staticPost",
                    "carousel",
                    "story",
                    "reel",
                ],

                supportedModes: [
                    "social.educational",
                    "social.trustBuilder",
                ],
            },

            {
                channel:
                    "instagram",

                supportedFormats: [
                    "staticPost",
                    "carousel",
                    "story",
                    "reel",
                ],

                supportedModes: [
                    "social.educational",
                    "social.trustBuilder",
                ],
            },
        ],

        capabilities: {
            eligibleProof:
                false,

            publicOfferFacts:
                false,
        },

        constraints: [
            "ფორმატმა არ უნდა შეცვალოს Content Brief-ის ძირითადი აზრი.",
            "არ შექმნა საბოლოო copy.",
            "არ გამოიყენო დაუდასტურებელი performance assumption.",
        ],
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT,
}