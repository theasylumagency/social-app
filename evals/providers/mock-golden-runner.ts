import type {
    GoldenModelRunner,
    StructuredModelRequest,
    StructuredModelResult,
} from "../golden/model-runner"

export class MockGoldenRunner implements GoldenModelRunner {
    async run<Input, Output>(
        request: StructuredModelRequest<Input>,
    ): Promise<StructuredModelResult<Output>> {
        if (request.task === "social.audience-hypothesis.generate") {
            return {
                model: "mock-candidate-v1",
                output: {
                    segments: [
                        {
                            name: "გადაწყვეტილების ეტაპზე მყოფი პაციენტი",
                            buyingSituation:
                                "უკვე იცის, რომ მკურნალობა სჭირდება და კლინიკას ან მკურნალობის ვარიანტს ადარებს.",
                            currentNeed:
                                "მიიღოს საკმარისი კონკრეტული ინფორმაცია ინფორმირებული არჩევანისთვის.",
                            relevantOffers: [
                                "Implantology",
                                "Orthodontics",
                                "Aesthetic dentistry",
                            ],
                            mainQuestions: [
                                "რა უნდა გავითვალისწინო კლინიკის არჩევისას?",
                                "როგორ იწყება მკურნალობის დაგეგმვა?",
                            ],
                            likelyBarriers: [
                                "provider comparison difficulty",
                                "risk perception",
                                "decision uncertainty",
                            ],
                            decisionStage: "providerComparison",
                            evidenceKeys: ["e1", "e2", "e4"],
                            rationale:
                                "კლინიკის რამდენიმე მომსახურება მაღალი ჩართულობის გადაწყვეტილებას მოითხოვს და მომხმარებელს არჩევამდე ხშირად სჭირდება პროცესისა და ვარიანტების გაგება.",
                            assumptions: [
                                "პირდაპირი მონაცემი კონკრეტულად კლინიკების შედარების ქცევაზე ჯერ არ გვაქვს.",
                            ],
                            confidenceBand: "reasonable",
                        },
                        {
                            name: "პრობლემის მქონე, მაგრამ ჯერ გაურკვეველი პაციენტი",
                            buyingSituation:
                                "ამჩნევს პრობლემას ან დისკომფორტს, მაგრამ ჯერ არ იცის რომელი მკურნალობა ან შემდეგი ნაბიჯია საჭირო.",
                            currentNeed:
                                "გაიგოს პრობლემა და გადაწყვიტოს საჭიროა თუ არა პროფესიული შეფასება.",
                            relevantOffers: [
                                "Diagnostics",
                                "Therapy",
                                "Periodontology",
                            ],
                            mainQuestions: [
                                "როდის არის საჭირო კონსულტაცია?",
                                "როგორ განისაზღვრება მკურნალობის სწორი გზა?",
                            ],
                            likelyBarriers: [
                                "uncertainty",
                                "technical complexity",
                                "delay",
                            ],
                            decisionStage: "problemAware",
                            evidenceKeys: ["e1", "e2", "e4"],
                            rationale:
                                "მრავალპროფილური კლინიკისა და დიაგნოსტიკური შესაძლებლობების არსებობა მიანიშნებს, რომ მნიშვნელოვანი აუდიტორია შეიძლება ჯერ პრობლემას ხედავდეს და არა კონკრეტულ პროცედურას.",
                            assumptions: [
                                "არ გვაქვს პირდაპირი behavioral მონაცემი პრობლემის აღმოჩენიდან ვიზიტამდე პერიოდზე.",
                            ],
                            confidenceBand: "reasonable",
                        },
                        {
                            name: "არსებული ან დაბრუნებული პაციენტი",
                            buyingSituation:
                                "უკვე აქვს კლინიკასთან ან მკურნალობის პროცესთან კავშირი და შეიძლება სჭირდებოდეს გაგრძელება, კონტროლი ან შემდეგი ეტაპი.",
                            currentNeed:
                                "გაიგოს რატომ არის მნიშვნელოვანი მკურნალობის ან მონიტორინგის გაგრძელება.",
                            relevantOffers: [
                                "Therapy",
                                "Orthodontics",
                                "Implantology",
                                "Periodontology",
                            ],
                            mainQuestions: [
                                "როდის არის საჭირო შემდეგი ვიზიტი?",
                                "რატომ არის მნიშვნელოვანი მკურნალობის გაგრძელება?",
                            ],
                            likelyBarriers: [
                                "inertia",
                                "treatment discontinuity",
                            ],
                            decisionStage: "returningCustomer",
                            evidenceKeys: ["e1", "e4"],
                            rationale:
                                "მრავალეტაპიანი სტომატოლოგიური მკურნალობები ბუნებრივად ქმნის გაგრძელებისა და დაბრუნების საჭიროებას.",
                            assumptions: [
                                "fixture არ შეიცავს კლინიკის რეალურ retention მონაცემებს.",
                            ],
                            confidenceBand: "reasonable",
                        },
                    ],
                } as Output,
            }
        }

        if (request.task === "golden.audience.semantic-evaluation") {
            return {
                model: "mock-judge-v1",
                output: {
                    scores: {
                        distinctness: 2,
                        businessSpecificity: 2,
                        evidenceDiscipline: 2,
                        managerialUsefulness: 2,
                        founderImpact: 2,
                    },
                    regressions: [],
                    summary:
                        "Smoke evaluation passed. Candidate demonstrates distinct buying situations and disciplined assumptions.",
                } as Output,
            }
        }

        throw new Error(
            `MockGoldenRunner does not support task: ${request.task}`,
        )
    }
}