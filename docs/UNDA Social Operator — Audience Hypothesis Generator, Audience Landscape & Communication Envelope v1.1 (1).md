# UNDA Social Operator — Audience Hypothesis Generator, Audience Landscape & Communication Envelope v1.1

## 0. Purpose

ეს დოკუმენტი განსაზღვრავს Social Operator-ის ოთხ ერთმანეთთან დაკავშირებულ კომპონენტს:

1. **Audience Hypothesis Generator**
2. **Founder Audience Feedback**
3. **Audience Landscape**
4. **Communication Envelope Generator**

ძირითადი flow:

```text
Business Understanding
→ Operator Audience Hypotheses
→ Founder Stances + Founder-Provided Audiences
→ Audience Landscape
→ Audience Communication Profiles
→ Communication Envelope
→ Weekly Planner
→ Content Directions
→ Writer
→ Results
→ Audience Learning
```

ძირითადი პრინციპი:

> Founder არ არის ვალდებული თვითონ განსაზღვროს სწორი target audience.

Operator ქმნის საუკეთესო სამუშაო ჰიპოთეზას არსებული წყაროების საფუძველზე.

Founder არ არედაქტირებს Operator-ის დასკვნას.

Founder ამატებს საკუთარ ცოდნასა და დამოკიდებულებას.

ორივე დამოუკიდებლად ინახება.

---

# Part I — Audience Hypothesis Generator

## 1. Core Responsibility

Audience Hypothesis Generator პასუხობს:

> არსებული ბიზნესის, შეთავაზების, პოზიციონირებისა და წყაროების მიხედვით, რა განსხვავებული audience buying situations შეიძლება იყოს მნიშვნელოვანი?

Generator არ ქმნის დეკორატიულ marketing persona-ს.

ძირითადი ერთეულია:

```text
Audience Segment
= distinguishable buying / decision situation
```

---

## 2. Segmentation Basis

Audience segment პირველ რიგში ეფუძნება:

- საჭიროებას;
- problem awareness-ს;
- decision readiness-ს;
- buying stage-ს;
- relationship to brand-ს;
- relevant offer-ს;
- purchase barrier-ს;
- decision role-ს.

Preferred examples:

```text
გადაწყვეტილებასთან ახლოს მყოფი მომხმარებელი
პრობლემის მქონე, მაგრამ ჯერ გადაუწყვეტელი მომხმარებელი
არსებული / დაბრუნებადი მომხმარებელი
სხვისთვის გადაწყვეტილების მიმღები
```

---

## 3. Avoid Invented Personas

Generator არ უნდა იგონებდეს:

- ასაკს;
- სქესს;
- შემოსავალს;
- პროფესიას;
- ინტერესებს;
- lifestyle-ს;
- ოჯახურ მდგომარეობას;
- ფსიქოგრაფიულ დეტალებს;

თუ შესაბამისი evidence არ არსებობს.

Audience description უნდა იყოს იმდენად კონკრეტული, რამდენადაც წყაროები გვაძლევს საშუალებას.

---

## 4. Inputs

Recommended compiled input:

```text
Business identity
Business category
Primary offers / services
Positioning
Geography
Pricing context if known
Business model
Purchase characteristics
Relevant Proof
Brand constraints
Existing communication
Existing audience evidence
Historical social content if available
```

Generator არ იღებს სრული raw Evidence graph-ს.

---

## 5. Output Size

Default:

```text
2–4 primary segments
```

მეტი segment მხოლოდ მაშინ, თუ რეალურად არსებობს განსხვავებული decision situation.

Complexity თავისთავად ღირებულება არ არის.

---

## 6. Audience Hypothesis Contract

Conceptual shape:

```text
AudienceHypothesis {
  id

  name
  buyingSituation
  currentNeed

  relevantOffers[]

  mainQuestions[]
  likelyBarriers[]

  decisionStage

  evidenceBasis[]
  assumptions[]

  confidenceBand

  origin: "operator"
  status
}
```

---

## 7. Confidence

Allowed semantic bands:

```text
strong
reasonable
tentative
```

არ გამოიყენება fake precision:

```text
82%
74 / 100
```

---

## 8. Status

Operator-generated segment შეიძლება იყოს:

```text
hypothesis
supported
challenged
retired
```

ეს სტატუსი არ უდრის founder-ის დამოკიდებულებას.

Founder feedback ცალკე ინახება.

---

# Part II — Founder Audience Feedback

## 9. Core Principle

Founder-ის feedback არ ცვლის Operator-ის hypothesis-ს.

ინახება ორი დამოუკიდებელი რამ:

```text
Operator assessment
Founder assessment
```

ეს საშუალებას გვაძლევს მომავალში შევადაროთ ორივე რეალურ performance evidence-ს.

---

## 10. Founder Stance

თითოეულ Operator-generated audience-ზე Founder ირჩევს:

```text
agree
unsure
disagree
```

UI language:

```text
ვეთანხმები
არ ვარ დარწმუნებული
არ ვეთანხმები
```

---

## 11. Founder Stance Contract

```text
FounderAudienceStance {
  audienceHypothesisId

  stance:
    | "agree"
    | "unsure"
    | "disagree"

  note?

  createdAt
  updatedAt
}
```

---

## 12. Meaning of `agree`

`agree` ნიშნავს:

> Founder-ის შიდა ბიზნეს-ცოდნა ამ hypothesis-ს ეთანხმება.

ეს ზრდის მის გამოყენებით მნიშვნელობას.

მაგრამ არ ნიშნავს, რომ audience უკვე ფაქტობრივად დადასტურებულია performance data-ით.

---

## 13. Meaning of `unsure`

`unsure` ნიშნავს:

> Founder-ს არ აქვს საკმარისი საფუძველი hypothesis-ის დასადასტურებლად ან უარსაყოფად.

ეს ჯანსაღი მდგომარეობაა.

Operator მუშაობას აგრძელებს.

---

## 14. Meaning of `disagree`

`disagree` არ ნიშნავს:

```text
delete audience
```

იგი ნიშნავს:

> Founder-ის არსებული ბიზნეს-ცოდნა Operator-ის hypothesis-ს ეწინააღმდეგება.

Hypothesis ინახება provenance-ით.

მისი operational weight მცირდება, მაგრამ იგი არ ქრება.

---

## 15. Founder-Provided Audiences

Founder-ს შეუძლია საკუთარი audience დაამატოს.

მაგალითად:

> უცხოეთში მცხოვრები ქართველები, რომლებიც საქართველოში ჩამოდიან მკურნალობისთვის.

ეს არ უნდა გარდაიქმნას Operator-generated hypothesis-ის edit-ად.

იქმნება ცალკე object.

---

## 16. Founder-Provided Audience Contract

```text
FounderProvidedAudience {
  id

  name
  description

  relevantOffers[]?
  notes?

  origin: "founder"

  createdAt
  updatedAt
}
```

Founder-ის მიერ დამატებული audience შეიძლება მოგვიანებით Operator-მა უფრო ღრმად გააანალიზოს, მაგრამ provenance არ იცვლება.

---

# Part III — Audience Review UX

## 17. Default Review Screen

Onboarding-ში generic კითხვა:

> ვინ არის თქვენი სამიზნე აუდიტორია?

იცვლება Operator-generated review-ით:

> თქვენი ბიზნესისა და არსებული წყაროების მიხედვით Operator-მა ამ ეტაპზე რამდენიმე მნიშვნელოვანი აუდიტორიული ჯგუფი გამოავლინა.

თითოეული card აჩვენებს:

```text
ვინ არის
რა მდგომარეობაშია
რა სჭირდება
რა უშლის ხელს
რატომ ვფიქრობთ ასე
```

Actions:

```text
ვეთანხმები
არ ვარ დარწმუნებული
არ ვეთანხმები
```

და ქვემოთ:

```text
+ ჩემი აუდიტორიის დამატება
```

---

## 18. No Edit Audience Action

Operator-generated card-ზე არ უნდა არსებობდეს generic:

```text
Edit
```

Founder არ არის hypothesis-ის თანაავტორი.

მისი როლია:

```text
evaluate
challenge
add context
add audience
```

---

## 19. Review Is Not Necessarily Blocking

თუ Operator-ს საკმარისი ინფორმაცია აქვს:

```text
readyWithUncertainty
```

მუშაობა შეიძლება გაგრძელდეს founder review-ის გარეშეც.

Founder feedback აუმჯობესებს system quality-ს, მაგრამ არ უნდა გადაიქცეს onboarding questionnaire-ის ახალ ფორმად.

---

# Part IV — Audience Landscape

## 20. Definition

**Audience Landscape** არის მოცემულ მომენტში ბრენდის აუდიტორიის სრული სამუშაო სურათი.

იგი შედგება:

```text
Operator Audience Hypotheses
+
Founder Stances
+
Founder-Provided Audiences
+
Later Performance-Based Learning
```

Audience Landscape არ არის ერთი flattened `targetAudience` field.

---

## 21. Why Audience Landscape Exists

რეალურ ბიზნესში შეიძლება არსებობდეს:

- ძლიერი Operator hypothesis;
- founder-ის მიერ უარყოფილი hypothesis;
- founder-ის მიერ დამატებული მნიშვნელოვანი niche;
- ჯერ გაურკვეველი segment;
- performance data-ით გაძლიერებული segment;
- performance data-ით დასუსტებული assumption.

ამ ყველაფრის ერთ field-ში შეყვანა ინფორმაციის დაკარგვას გამოიწვევს.

---

## 22. Conceptual Contract

```text
AudienceLandscape {
  operatorHypotheses[]
  founderStances[]
  founderProvidedAudiences[]

  derivedAudienceWeights[]
  learningSignals[]

  version
  generatedAt
}
```

`derivedAudienceWeights` არის recomputable guidance და არა raw truth.

---

## 23. Audience Weighting Principle

ყველა audience ერთნაირი მნიშვნელობით არ მონაწილეობს Communication Envelope-ში.

Conceptual weighting:

| State | Relative role |
|---|---|
| Operator hypothesis + founder agrees | ძლიერი input |
| Operator hypothesis + founder unsure | ჩვეულებრივი working input |
| Operator hypothesis not reviewed | working hypothesis |
| Operator hypothesis + founder disagrees | დაბალი წონა / challenged |
| Founder-provided audience | მნიშვნელოვანი founder input |
| Repeated performance-supported audience | გაძლიერებული operational input |

ზუსტი numeric score აუცილებელი არ არის.

Semantic weighting საკმარისია.

---

## 24. Disagreement Preservation

თუ Founder არ ეთანხმება Operator-ს:

```text
Operator hypothesis remains
Founder disagreement remains
```

System არ ირჩევს „ვინ არის მართალი“.

ახალი evidence შეიძლება მოგვიანებით შეცვალოს operational interpretation.

---

# Part V — Audience Communication Profiles

## 25. Purpose

თითოეულ relevant segment-ს შეიძლება ჰქონდეს derived communication profile:

> როგორ უნდა ილაპარაკოს ამ ბრენდმა ამ კონკრეტულ audience situation-თან?

---

## 26. Inputs

```text
Brand Voice
Audience Segment
Audience Origin
Founder Stance if applicable
Decision Stage
Current Need
Barriers
Positioning
Relevant Offers
Eligible Proof
Brand Constraints
```

---

## 27. Output

```text
AudienceCommunicationProfile {
  audienceId

  communicationGoal

  toneAdjustments[]

  preferredFraming[]
  usefulContentAngles[]

  assumedKnowledge
  explanationDepth

  trustMechanisms[]

  CTAStyle

  avoid[]
}
```

---

## 28. Brand Voice Is Preserved

Formula:

```text
Brand Voice
+ Audience Situation
= Communication Adaptation
```

არა:

```text
Audience preference
→ replace Brand Voice
```

---

# Part VI — Communication Envelope

## 29. Definition

Communication Envelope არის საერთო organic communication corridor:

> როგორ უნდა ილაპარაკოს ბრენდმა ისე, რომ Audience Landscape-ის მთავარ სეგმენტებს მაქსიმალურად მოერგოს და თან საკუთარი ხმა არ დაკარგოს?

---

## 30. Inputs

```text
Brand Voice
Audience Landscape
Audience Communication Profiles
Positioning
Offer Structure
Brand Constraints
Channel Context
```

---

## 31. Founder Feedback Matters Here

Communication Envelope Generator აუცილებლად ითვალისწინებს:

```text
agree
unsure
disagree
founder-provided
```

მაგრამ არც Founder Stance და არც Operator Hypothesis ცალკე არ წარმოადგენს საბოლოო truth-ს.

Envelope იქმნება მთლიან landscape-ზე.

---

## 32. Example Logic

თუ გვაქვს:

```text
Audience A
operator hypothesis
founder: agree

Audience B
operator hypothesis
founder: unsure

Audience C
operator hypothesis
founder: disagree

Audience D
founder-provided
```

Envelope Generator უნდა:

- ძლიერ გაითვალისწინოს A;
- B-სთან თავსებადი დარჩეს;
- C-მ არ უნდა განსაზღვროს საერთო tone;
- D აუცილებლად უნდა შეაფასოს როგორც founder-ის მნიშვნელოვანი knowledge input.

---

## 33. Communication Envelope Contract

```text
CommunicationEnvelope {
  version

  complexity
  assumedKnowledge
  explanationDepth

  toneRange[]

  framingRules[]
  preferredStructures[]

  terminologyRules[]

  proofStyle
  CTAStyle
  salesPressure

  inclusivityRules[]

  trustMechanisms[]

  avoid[]

  rationale
}
```

---

## 34. Main Goal

Envelope უნდა იყოს:

```text
simple enough for lower-knowledge audiences
specific enough for high-intent audiences
professional enough for existing customers
consistent with brand positioning
```

---

## 35. Communication Envelope Is Derived

Communication Envelope არ არის Brand Knowledge truth.

იგი არის:

```text
recomputable derived guidance
```

თუ შეიცვალა:

- Audience Landscape;
- Brand Voice;
- Positioning;
- major constraints;

Envelope შეიძლება თავიდან გენერირდეს.

---

# Part VII — Weekly Planner Integration

## 36. Planner Input

Weekly Planner იღებს:

```text
Brand Knowledge
Audience Landscape
Communication Envelope
User Priority
Relevant Business Facts
Recent Results
Learned Signals
```

---

## 37. Weekly Audience Focus

Planner-ს შეუძლია ამ კვირისთვის აირჩიოს:

```text
Primary Audience
Secondary Audience
```

მაგრამ ჩვეულებრივი organic content მაინც რჩება საერთო Communication Envelope-ის ფარგლებში.

---

## 38. Example

Audience Landscape:

```text
A — decision-ready
B — problem-aware
C — existing customers
D — founder-added diaspora audience
```

Weekly Planner შეიძლება გადაწყვიტოს:

```text
Primary: B
Secondary: A
```

მაგრამ Writer-ს მაინც არ ეძლევა უფლება ისეთი ტექსტი შექმნას, რომელიც C და D-სთვის მთლიანად უცხო ბრენდად ჟღერს.

---

# Part VIII — Writer Integration

## 39. Writer Receives Compiled Guidance

Writer იღებს:

```text
Brand Voice
Communication Envelope
Primary Audience Focus
Secondary Audience Focus if relevant
Weekly Objective
Content Role
Channel
Relevant Facts
Eligible Proof
Task Instruction
```

Writer არ წყვეტს თავიდან:

```text
who are we talking to?
what kind of brand is this?
what tone should we use?
```

---

## 40. Communication Bias

თითო პოსტს შეიძლება ჰქონდეს envelope-ის ფარგლებში მცირე bias:

```text
more explanatory
more decision-oriented
more trust-focused
more practical
```

ეს არ ქმნის ახალ brand voice-ს.

---

# Part IX — Learning Loop

## 41. Performance Does Not Automatically Rewrite Audience Landscape

ერთი წარმატებული პოსტი არ ნიშნავს:

> ეს არის ჩვენი რეალური აუდიტორია.

იგი ქმნის:

```text
Audience Learning Candidate
```

---

## 42. Audience Learning Candidate

```text
AudienceLearningCandidate {
  audienceId

  observation
  context

  recurrence
  competingExplanations[]

  confidenceBand
}
```

---

## 43. Founder vs Performance Tension

თუ founder stance არის:

```text
disagree
```

მაგრამ რამდენიმე ციკლის შედეგი სტაბილურად საპირისპირო სიგნალს აჩვენებს:

Operator არ ცვლის founder stance-ს.

იგი ქმნის tension-ს:

> ახალი performance evidence საწყის founder assessment-ს ეწინააღმდეგება.

შემდეგ შეიძლება user-facing recommendation:

> ამ აუდიტორიის მნიშვნელობის ხელახლა შეფასება შეიძლება ღირდეს.

---

## 44. Operator Must Not Say

> თქვენ შეცდით.

ან:

> AI-მ სწორად განსაზღვრა.

Preferred framing:

> ახალი მონაცემი საწყის მოსაზრებას აღარ ემთხვევა.

---

# Part X — Golden Brand Test

## 45. Total Charm Dent

Total Charm Dent რჩება პირველ Golden Brand reference case-ად.

Expected quality:

```text
distinct buying situations
no invented demographic personas
clear needs
clear barriers
usable founder review
useful common communication envelope
usable weekly audience focus
```

---

## 46. Golden Test Includes Founder Feedback

Reference test-ს უნდა შეეძლოს scenario-ები:

```text
Founder agrees with A
Founder unsure about B
Founder disagrees with C
Founder adds D
```

შემდეგ უნდა შევამოწმოთ:

> Communication Envelope კვლავ coherent არის?

> C-ს disagreement ზედმეტად ხომ არ მართავს output-ს?

> Founder-added D რეალურად აისახა თუ უბრალოდ ჩაიკარგა?

---

# Part XI — v1.1 Implementation Boundary

## 47. Required

### Audience Generator

```text
compiled business context
2–4 structured hypotheses
evidence basis
assumptions
confidence band
```

### Founder Feedback

```text
agree / unsure / disagree
optional note
founder-provided audience
preserved provenance
```

### Audience Landscape

```text
combined read model
semantic weighting
versioned derived state
```

### Communication Envelope

```text
landscape-aware generation
structured output
recomputable state
writer integration
```

---

## 48. Not Required Yet

```text
Meta Ads targeting
demographic targeting suggestions
lookalike audiences
media buying
campaign budget allocation
real-time targeting optimization
```

ეს paid advertising layer-ის ცალკე კომპონენტია.

---

# 49. Final Product Principle

Audience understanding არ არის ერთი `Target Audience` field.

იგი არის განვითარებადი knowledge system, სადაც:

```text
Operator proposes
Founder reacts
Founder adds
Results provide evidence
System learns
```

არცერთი მონაწილე არ შლის მეორის provenance-ს.

---

# 50. Final Flow

```text
SOURCE EVIDENCE
↓
BUSINESS UNDERSTANDING
↓
OPERATOR AUDIENCE HYPOTHESES
↓
FOUNDER STANCES
+
FOUNDER-PROVIDED AUDIENCES
↓
AUDIENCE LANDSCAPE
↓
AUDIENCE COMMUNICATION PROFILES
↓
COMMUNICATION ENVELOPE
↓
WEEKLY AUDIENCE FOCUS
↓
CONTENT DIRECTIONS
↓
WRITER
↓
RESULTS
↓
AUDIENCE LEARNING
↓
UPDATED LANDSCAPE / FUTURE DECISIONS
```

ეს არის Social Operator-ის audience intelligence loop.