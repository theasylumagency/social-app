const {
    TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT,
} = require(
    "./total-charm-dent.weekly-audience-focus.fixture.cjs",
)

const TOTAL_CHARM_DENT_CONTENT_AUDIENCE_DIRECTION_INPUT =
    Object.freeze({
        caseId:
            "total-charm-dent-content-audience-direction-v1",

        locale:
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT.locale,

        weeklyObjective:
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT.weeklyObjective,

        weeklyAudienceFocus: {
            primaryAudienceKey: "a1",

            secondaryAudienceKeys: [
                "a2",
            ],

            rationale:
                "ამ კვირის მთავარი ფოკუსია მკურნალობის გადაწყვეტილებაში გაურკვევლობის შემცირება; a2 მეორადად მნიშვნელოვანია რთული არჩევანისა და ვარიანტების შედარების კონტექსტში.",
        },

        audiences:
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT.audiences,

        communicationEnvelope:
            TOTAL_CHARM_DENT_WEEKLY_AUDIENCE_FOCUS_INPUT.communicationEnvelope,

        contentDirections: [
            {
                contentDirectionKey: "d1",

                direction:
                    "აჩვენოს, რას არკვევს პროფესიული შეფასება მკურნალობის არჩევამდე და რატომ არ არის სწორი მკურნალობის წინასწარ განსაზღვრა.",

                purpose:
                    "შეამციროს გაურკვევლობა შეფასებისა და დიაგნოსტიკის პროცესის გასაგებად წარმოჩენით.",
            },

            {
                contentDirectionKey: "d2",

                direction:
                    "ახსნას, რატომ შეიძლება ერთსა და იმავე პრობლემას ჰქონდეს რამდენიმე შესაძლო მკურნალობის გზა და რა ფაქტორები განსაზღვრავს ინდივიდუალურ რეკომენდაციას.",

                purpose:
                    "დაეხმაროს მკითხველს ვარიანტების არსებობისა და კლინიკური გადაწყვეტილების ლოგიკის გაგებაში.",
            },

            {
                contentDirectionKey: "d3",

                direction:
                    "აჩვენოს, როგორ ნაწილდება სხვადასხვა სპეციალისტის როლი რთული მკურნალობის დაგეგმვისას და რატომ არის კოორდინაცია საერთო გეგმის ნაწილი.",

                purpose:
                    "გააძლიეროს ნდობა რთული მკურნალობის პროცესის ორგანიზებისა და პროფესიული კოორდინაციის მიმართ.",
            },
        ],
    })

module.exports = {
    TOTAL_CHARM_DENT_CONTENT_AUDIENCE_DIRECTION_INPUT,
}