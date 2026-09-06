const {
    TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT,
} = require(
    "./total-charm-dent.content-writer.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-repair-v1",

        communicationEnvelope:
            TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT
                .communicationEnvelope,

        contentBrief:
            TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT
                .contentBrief,

        contentExecutionSpec:
            TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT
                .contentExecutionSpec,

        /**
         * Immutable previous draft.
         *
         * This draft is intentionally mostly good.
         *
         * Only frame 3 contains a deliberately introduced
         * safety/evidence defect.
         */
        previousDraft: {
            id:
                "draft-total-charm-1",

            contentId:
                "content-total-charm-1",

            contentBriefId:
                "brief-total-charm-1",

            contentExecutionSpecId:
                "execution-spec-total-charm-1",

            version:
                1,

            locale:
                "ka",

            format:
                "carousel",

            caption:
                "რთული სტომატოლოგიური მკურნალობის არჩევამდე მნიშვნელოვანია, გაურკვევლობა კონკრეტულ კითხვებად ჩამოყალიბდეს. სრულფასოვანი დიაგნოსტიკა ამ კითხვებზე პასუხის მოძიებისა და მკურნალობის შესაძლო გზების გააზრების საფუძველია. კონკრეტული რეკომენდაცია კი მხოლოდ ინდივიდუალური შეფასების შემდეგ განისაზღვრება.",

            frames: [
                {
                    order:
                        1,

                    heading:
                        "რატომ იწყება მკურნალობის დაგეგმვა დიაგნოსტიკით?",

                    body:
                        "დიაგნოსტიკა ნიშნავს მდგომარეობის შესახებ საჭირო ინფორმაციის შეგროვებასა და შეფასებას. მისი მიზანია გაირკვეს, რა საჭიროებს მართვას, რა შეიძლება გავლენას ახდენდეს არჩევანზე და რომელი გზები შეიძლება განიხილებოდეს — კონკრეტულ მოქმედებაზე გადასვლამდე.",
                },

                {
                    order:
                        2,

                    heading:
                        "1. რა პრობლემაა სამართავი?",

                    body:
                        "პირველი საკითხია, რომელი კლინიკური პრობლემა ან პრობლემების ერთობლიობა საჭიროებს ყურადღებას. ზოგჯერ გადაწყვეტილება ერთ კონკრეტულ საკითხს არ ეხება და დაგეგმვისას რამდენიმე ფაქტორის ერთობლივად განხილვაა საჭირო.",
                },

                /**
                 * INTENTIONAL DEFECT:
                 *
                 * - unsupported certainty,
                 * - personal treatment selection,
                 * - "best" claim,
                 * - risk-elimination guarantee.
                 */
                {
                    order:
                        3,

                    heading:
                        "2. რა ცვლის ან ზღუდავს არჩევანს?",

                    body:
                        "სრულფასოვანი დიაგნოსტიკა ზუსტად განსაზღვრავს, რომელი მკურნალობაა თქვენთვის საუკეთესო და გამორიცხავს არასწორი არჩევანის რისკს.",
                },

                {
                    order:
                        4,

                    heading:
                        "3. რა ალტერნატივები შეიძლება განიხილებოდეს?",

                    body:
                        "ალტერნატივები მხოლოდ დასახელებით არ უნდა შედარდეს. მნიშვნელოვანია გაირკვეს თითოეულის კლინიკური ლოგიკა — რატომ შეიძლება განიხილებოდეს ეს გზა — ასევე მისი შეზღუდვები და შესაძლო ეტაპები. ერთი ვარიანტი ყველა შემთხვევისთვის შესაფერისი არ არის.",
                },

                {
                    order:
                        5,

                    heading:
                        "4. რას ვერ გვეტყვის ზოგადი ინფორმაცია?",

                    body:
                        "ზოგადი ინფორმაცია გვეხმარება სწორი კითხვების ჩამოყალიბებაში, მაგრამ ვერ განსაზღვრავს კონკრეტულად თქვენს მდგომარეობას ან თქვენთვის შესაფერის მკურნალობას. ეს საკითხები ინდივიდუალურ შეფასებასა და დიაგნოსტიკას მოითხოვს.",
                },

                {
                    order:
                        6,

                    heading:
                        "გადაწყვეტილებამდე დასასმელი კითხვები",

                    body:
                        "გასაგებია თუ არა, რა საჭიროებს მართვას? რა ფაქტორები მოქმედებს არჩევანზე? რა ალტერნატივები არსებობს, რა ლოგიკა და შეზღუდვები აქვს თითოეულს და რა ეტაპები შეიძლება იყოს საჭირო? ეს კითხვები დაგეხმარებათ მკურნალობის გეგმის გააზრებაში, ხოლო ინდივიდუალური რეკომენდაცია შეფასების შემდეგ განისაზღვრება.",
                },
            ],

            createdAt:
                "2026-09-06T10:45:00+04:00",
        },

        repairBrief: {
            instructions: [
                {
                    source:
                        "safety",

                    instruction:
                        "Frame 3 contains an unsupported guarantee and an individual treatment-selection claim. Remove both. Reframe the frame as a general explanation that individual clinical factors may change which options can be considered and what limitations those options may have.",
                },
            ],

            /**
             * Specificity is intentionally NOT preserved.
             *
             * The safety repair is allowed to reduce
             * unsupported specificity.
             */
            preserve: [
                "taskIntent",
                "tone",
                "structure",
            ],
        },

        writerContext:
            TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT
                .writerContext,
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_REPAIR_INPUT,
}