const {
    TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT,
} = require(
    "./total-charm-dent.content-execution-spec.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-writer-v1",

        locale:
            TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT.locale,

        communicationEnvelope:
            TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT.communicationEnvelope,

        contentBrief:
            TOTAL_CHARM_DENT_CONTENT_EXECUTION_SPEC_INPUT.contentBrief,

        /**
         * Canonical approved execution spec.
         *
         * This is the real Golden PASS selected
         * by Content Execution Spec v1.
         */
        contentExecutionSpec: {
            channel:
                "instagram",

            contentMode:
                "social.educational",

            format:
                "carousel",

            depth:
                "standard",

            visualDependency:
                "supporting",

            executionGuidance: [
                "კარუსელი ააგეთ თანმიმდევრულად: ჯერ შეფასებისა და დიაგნოსტიკის როლი, შემდეგ ოთხი ძირითადი საკითხი, რომელთა გარკვევასაც მკურნალობის დაგეგმვა ემსახურება.",
                "თითოეული საკითხი წარმოადგინეთ როგორც გადაწყვეტილების გასაგებად საჭირო მიმართულება და არა როგორც თვითდიაგნოსტიკის ინსტრუმენტი.",
                "ალტერნატივების განხილვისას შეინარჩუნეთ კლინიკური ლოგიკის, შეზღუდვებისა და შესაძლო ეტაპების შედარება ისე, რომ არც ერთი ვარიანტი არ გამოჩნდეს უნივერსალურად სწორად.",
                "დასასრულს მკაფიოდ გამიჯნეთ ზოგადი საგანმანათლებლო ჩარჩო ინდივიდუალური შეფასების შემდეგ განსაზღვრული რეკომენდაციისგან.",
                "ვიზუალური იერარქია გამოიყენეთ საკითხების გასამიჯნად, თუმცა ძირითადი აზრი ტექსტური განმარტების გარეშეც არ უნდა დაიკარგოს.",
            ],

            constraints: [
                "კარუსელის თანმიმდევრობამ შეფასებისა და დიაგნოსტიკის საჭიროება შესაძლო მოქმედებამდე უნდა წარმოაჩინოს.",
                "ცალკეულმა კადრმა არ უნდა შექმნას წინასწარი დიაგნოზის ან ინდივიდუალური რეკომენდაციის შთაბეჭდილება.",
                "ტექნიკური ცნებების ვიზუალურმა შემოკლებამ არ უნდა გააქროს მათი მარტივი განმარტება.",
                "ბოლო კადრმა არ უნდა გარდაქმნას რეფლექსიური მოწოდება გაყიდვით ან გადაუდებელ შეთავაზებად.",
            ],

            rationale:
                "კარუსელის თანმიმდევრული სტრუქტურა ეხმარება აუდიტორიას გაურკვევლობა ოთხ კონკრეტულ საკითხთან დააკავშიროს, თან ინარჩუნებს ერთ მთავარ აზრსა და ინდივიდუალური შეფასების აუცილებელ საზღვარს.",
        },

        /**
         * Compiled generation context.
         *
         * Some fields may become public copy.
         * Others are internal calibration only.
         */
        writerContext: {
            taskId:
                "writer-task-1",

            instruction:
                "Write final Georgian copy for the approved Instagram carousel.",

            publicFacts: [
                {
                    key:
                        "clinic.diagnosticsProcess",

                    value:
                        "დიაგნოსტიკა და მკურნალობის დაგეგმვა კლინიკის სამუშაო პროცესის ნაწილია.",
                },

                {
                    key:
                        "clinic.multidisciplinary",

                    value:
                        "კლინიკაში სხვადასხვა პროფილის სტომატოლოგები მუშაობენ.",
                },
            ],

            internalGuidance: [
                {
                    key:
                        "positioning",

                    value:
                        "მრავალპროფილური კლინიკა, სადაც რთული გადაწყვეტილებები უნდა აიხსნას მშვიდად და პროფესიონალურად.",
                },

                {
                    key:
                        "audienceInternalLabel",

                    value:
                        "problem-aware but treatment-uncertain",
                },
            ],

            constraints: [
                {
                    type:
                        "clinicalBoundary",

                    instruction:
                        "Do not imply diagnosis or treatment recommendation without individual assessment.",
                },

                {
                    type:
                        "unsupportedClaim",

                    instruction:
                        "Do not claim guaranteed outcomes or superiority.",
                },
            ],

            proof: [],

            audience: {
                value: {
                    primary:
                        "ადამიანი, რომელსაც ესმის, რომ სტომატოლოგიური პრობლემა აქვს, მაგრამ მკურნალობის სწორი გზა ჯერ გაურკვეველია.",

                    bias:
                        "moreExplanatory",
                },
            },

            contentDirection: {
                value:
                    "Explain what full diagnostics should clarify before a complex treatment decision.",
            },

            voice: {
                value: {
                    tone: [
                        "მშვიდი",
                        "პროფესიონალური",
                        "გასაგები",
                        "არასაჭარბო",
                    ],

                    formality:
                        "professional",

                    salesPressure:
                        "low",

                    avoid: [
                        "ხმამაღალი დაპირებები",
                        "ხელოვნური გადაუდებლობა",
                        "ზედმეტი სარეკლამო ენა",
                    ],
                },
            },

            fallbacks: [
                {
                    strategy:
                        "social.omitUnsupportedSpecifics",

                    instruction:
                        "If a useful detail is not supported, omit it instead of inventing it.",
                },
            ],

            learnedPreferences: [],
        },
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_WRITER_INPUT,
}