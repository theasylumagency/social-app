const {
    TOTAL_CHARM_DENT_GOLDEN_INPUT,
} = require("./total-charm-dent.fixture.cjs")

const TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT = Object.freeze({
    caseId: "total-charm-dent-communication-profile-v1",
    locale: TOTAL_CHARM_DENT_GOLDEN_INPUT.locale,

    brandVoice: TOTAL_CHARM_DENT_GOLDEN_INPUT.voice,
    positioning: TOTAL_CHARM_DENT_GOLDEN_INPUT.positioning,

    constraints: [
        ...TOTAL_CHARM_DENT_GOLDEN_INPUT.constraints,
        "Brand Voice is authoritative and must not be replaced.",
        "Do not invent audience facts.",
        "Do not invent proof, outcomes, prices, testimonials, or guarantees.",
    ],

    audiences: [
        {
            audienceKey: "a1",
            influence: "standard",

            name:
                "პრობლემის მქონე, მაგრამ საჭირო მკურნალობაში გაურკვეველი პაციენტები",

            buyingSituation:
                "ადამიანს აქვს სტომატოლოგიური პრობლემა ან ჩივილი, თუმცა ჯერ არ იცის, რა ტიპის გამოკვლევა ან მკურნალობა სჭირდება.",

            currentNeed:
                "პრობლემის პროფესიული შეფასება, დიაგნოზის გასაგებად ახსნა და შემდგომი ნაბიჯების განსაზღვრა.",

            decisionStage: "problemAware",

            mainQuestions: [
                "რა არის პრობლემის მიზეზი?",
                "რომელი კვლევა ან მკურნალობა მჭირდება?",
                "რა ეტაპებისგან შედგება შემოთავაზებული გეგმა?",
            ],

            likelyBarriers: [
                "ტექნიკური ინფორმაციის გაგების სირთულე",
                "მკურნალობის მოცულობასთან დაკავშირებული გაურკვევლობა",
                "კლინიკის მიმართ ნდობის საჭიროება",
            ],
        },

        {
            audienceKey: "a2",
            influence: "standard",

            name:
                "მაღალი ნდობის საჭიროების მქონე პაციენტები, რომლებიც კლინიკებს ადარებენ",

            buyingSituation:
                "ადამიანი განიხილავს ტექნიკურად რთულ ან მრავალეტაპიან მკურნალობას და საბოლოო არჩევანამდე აფასებს კლინიკის პროფესიულ კომპეტენციას, დიაგნოსტიკურ შესაძლებლობებსა და გადაწყვეტილების დასაბუთებას.",

            currentNeed:
                "სანდო პროვაიდერის არჩევა და მკურნალობის ვარიანტების, ეტაპებისა და კლინიკური მიდგომის მკაფიოდ გაგება.",

            decisionStage: "providerComparison",

            mainQuestions: [
                "რატომ არის რეკომენდებული კონკრეტული მკურნალობის გზა?",
                "როგორ გამოიყენება დიაგნოსტიკა და ციფრული დაგეგმვა?",
                "რა ალტერნატივები არსებობს?",
            ],

            likelyBarriers: [
                "მაღალი აღქმული რისკი",
                "ტექნიკური სირთულე",
                "პროვაიდერებს შორის განსხვავებების შეფასების სირთულე",
            ],
        },

        {
            audienceKey: "a3",
            influence: "standard",

            name:
                "მიმდინარე მრავალეტაპიანი მკურნალობის პაციენტები",

            buyingSituation:
                "პაციენტს უკვე დაწყებული აქვს მკურნალობა და სჭირდება დაგეგმილი ეტაპების, შემდგომი ვიზიტებისა და სხვადასხვა მიმართულების ჩართულობის თანმიმდევრულად გაგრძელება.",

            currentNeed:
                "მკურნალობის უწყვეტობა, მიმდინარე გეგმის გაგება და შემდეგი ეტაპების კოორდინაცია.",

            decisionStage: "existingCustomer",

            mainQuestions: [
                "რა არის მკურნალობის შემდეგი ეტაპი?",
                "რატომ არის საჭირო სხვა სპეციალისტის ჩართვა?",
                "როგორ უკავშირდება მიმდინარე პროცედურა მთლიან გეგმას?",
            ],

            likelyBarriers: [
                "შემდეგი ნაბიჯების გაურკვევლობა",
                "სხვადასხვა მიმართულებას შორის კოორდინაციის საჭიროება",
                "ნდობის შენარჩუნების საჭიროება",
            ],
        },
    ],
})

module.exports = {
    TOTAL_CHARM_DENT_COMMUNICATION_PROFILE_INPUT,
}