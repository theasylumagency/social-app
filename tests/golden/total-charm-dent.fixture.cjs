const TOTAL_CHARM_DENT_GOLDEN_INPUT = Object.freeze({
    caseId: "total-charm-dent-v1",
    locale: "ka",

    business: {
        name: "Total Charm Dent",
        industry: "dental clinic",
        description:
            "Multi-service dental clinic in Vake, Tbilisi, providing diagnostic, therapeutic, orthodontic, surgical, implantology and aesthetic dental services.",
        geography: ["Tbilisi", "Vake"],
        businessModel: "B2C professional healthcare service",
    },

    offers: [
        { name: "Diagnostics", priority: "primary" },
        { name: "Therapy", priority: "primary" },
        { name: "Orthodontics", priority: "primary" },
        { name: "Implantology", priority: "primary" },
        { name: "Aesthetic dentistry", priority: "primary" },
        { name: "Ceramic veneers", priority: "secondary" },
        { name: "Periodontology", priority: "secondary" },
        { name: "Digital modelling", priority: "secondary" },
    ],

    positioning: {
        corePosition:
            "Professional, quality-focused dental care with a calm and restrained premium character.",
        differentiators: [
            "multi-disciplinary treatment",
            "diagnostic and digital capabilities",
            "professional clinical expertise",
        ],
        valuePropositions: [
            "clear treatment understanding",
            "professional care",
            "trustworthy decision support",
        ],
    },

    voice: {
        primaryTone: [
            "calm",
            "competent",
            "clear",
            "confident",
            "restrained",
        ],
    },

    businessContext: {
        purchaseCharacteristics: [
            "high trust requirement",
            "meaningful perceived risk",
            "technical complexity",
            "provider comparison",
            "decision uncertainty",
            "treatment continuity",
        ],
    },

    evidenceSummary: [
        {
            evidenceKey: "e1",
            statement:
                "The clinic provides several treatment categories including orthodontics, implantology, therapy and aesthetic dentistry.",
            strength: "strong",
        },
        {
            evidenceKey: "e2",
            statement:
                "The clinic presents diagnostic and digital treatment capabilities.",
            strength: "strong",
        },
        {
            evidenceKey: "e3",
            statement:
                "The brand communication is professional, calm and quality-focused rather than promotional or discount-led.",
            strength: "medium",
        },
        {
            evidenceKey: "e4",
            statement:
                "Several offered treatments involve multi-step treatment decisions rather than simple impulse purchases.",
            strength: "strong",
        },
    ],

    constraints: [
        "Do not invent demographic characteristics.",
        "Do not make unsupported clinical outcome claims.",
        "Do not infer price positioning beyond supplied context.",
    ],
})

module.exports = {
    TOTAL_CHARM_DENT_GOLDEN_INPUT,
}