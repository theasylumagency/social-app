import {validateSchema} from "../../blueprints/social/brand-discovery/validation";
import { currentWeek } from '../dashboard/model';
import { bindWeeklyDirectives, validateWeeklyDirectives, type BoundWeeklyDirectives } from '../weekly-planning/instruction-contract';
import { countPostChannels, POST_COPY_V2_SCHEMA, POST_COPY_SCHEMA, validatePostCopy, type PostCopy, type PostsPayload } from '../../blueprints/social/weekly-planning/posts';
import { decideNote, interpretChannelPolicy, interpretOperatingRule, targetHash, INTERPRETATION_V2_SCHEMA, INTERPRETER_PROMPT, WEEKLY_DIRECTIVE_PROMPT, type Interpretation, type NoteContext, type NoteEntry } from './model';
import type { BrandReasoner } from '../../infrastructure/models/brand-reasoning';
import type { PlanningRun, PlanningView } from '../../blueprints/social/weekly-planning/model';
import type { BrandDossier } from '../../blueprints/social/brand-discovery/model';
import { validateFactualReferences } from '../../blueprints/social/public-knowledge';
import { applicablePostOperatingRules, compilePostGenerationContext, validateVariantOperatingRules } from '../../blueprints/social/weekly-planning/post-context';
import { operatingRuleEnforcement, type OperatingRuleDraft, type OperatingRule, type SocialChannel } from '../../core/domain/operating-policy';
import { noteDigest as hash } from './identity';
export type NoteSnapshot = {
    revision?: {
        run: PlanningRun;
        posts: import("../../blueprints/social/weekly-planning/posts").PostsBatch;
        parentRevisionId: string | null;
    };
    weeklyDirectives?: BoundWeeklyDirectives;
    // Legacy fields remain readable for notes created before migration 0019.
    run?: PlanningRun | null;
    dossier?: BrandDossier | null;
    posts?: PostsPayload | null;
    postCopy?: PostCopy;
    revisedCopy?: PostCopy;
    plan?: {
        runId: string;
        version: number;
        status: PlanningRun["status"];
        updatedAt: string;
        priority: string;
        payloadHash: string;
    };
    brand?: {
        sessionId: string;
        revision: number;
        inputNotesHash: string;
    };
    post?: {
        runId: string;
        postKey: string;
        channel: SocialChannel;
        batchUpdatedAt: string;
        before: PostCopy;
        after?: PostCopy;
    };
    rule?: OperatingRuleDraft;
    channelPolicy?: {
        channel: SocialChannel;
        active: boolean;
        previousActive: boolean;
        affectedFuture: number;
        unresolved: number;
    };
};
type CanonicalTarget = {
    version: string;
    label: string;
    data: Record<string, unknown>;
};
function resolveCanonicalTarget(context: NoteContext, planning: PlanningView, dossier: BrandDossier | null): CanonicalTarget {
    const target = context.target;
    if (!target)
        throw Error("არჩეული ობიექტი ვერ მოიძებნა.");
    if (target.type === "post") {
        const post = context.postKey ? planning.posts?.payload.outline?.posts[Number(context.postKey.slice(1)) - 1] : null;
        if (!post || !context.postKey || !context.channel || !planning.posts || target.id !== `${context.postKey}:${context.channel}` || !post.channels.some(item => item.channel === context.channel))
            throw Error("არჩეული პოსტი შეიცვალა. განაახლეთ გვერდი და ხელახლა აირჩიეთ.");
        return { version: planning.posts.updatedAt, label: post.title, data: { postKey: context.postKey, channel: context.channel, title: post.title } };
    }
    if (["weekly_objective", "audience_focus", "content_direction", "progress_signal"].includes(target.type)) {
        const run = planning.run, plan = run?.payload.plan;
        if (!run || !plan)
            throw Error("არჩეული გეგმის ნაწილი აღარ არსებობს. განაახლეთ გვერდი.");
        if (target.type === "weekly_objective" && target.id === "objective")
            return { version: run.updatedAt, label: "კვირის მთავარი ამოცანა", data: { objective: plan.objective.objective, rationale: plan.objective.rationale } };
        if (target.type === "audience_focus") {
            const primary = plan.audienceFocus.primary;
            if (target.id !== `${primary.source}:${primary.id}`)
                throw Error("არჩეული აუდიტორიული ფოკუსი შეიცვალა. განაახლეთ გვერდი.");
            const audience = run.payload.basis.payload.landscape?.entries.find(entry => entry.source === primary.source && entry.audience.id === primary.id)?.audience;
            return { version: run.updatedAt, label: "კვირის აუდიტორიული ფოკუსი", data: { primary, name: audience?.name ?? null, rationale: plan.audienceFocus.rationale } };
        }
        if (target.type === "content_direction") {
            const direction = plan.contentDirections.find(item => item.id === target.id);
            if (!direction)
                throw Error("არჩეული კონტენტის მიმართულება შეიცვალა. განაახლეთ გვერდი.");
            return { version: run.updatedAt, label: `კონტენტის მიმართულება: ${direction.direction}`, data: { direction: direction.direction, purpose: direction.purpose, rationale: direction.rationale, order: direction.order } };
        }
        const index = Number(target.id.match(/^signal-(\d+)$/u)?.[1]) - 1;
        const signal = run.payload.review?.progressSignals[index];
        if (!signal || index < 0)
            throw Error("არჩეული პროგრესის ნიშანი შეიცვალა. განაახლეთ გვერდი.");
        return { version: run.updatedAt, label: `პროგრესის ნიშანი ${index + 1}`, data: { signal } };
    }
    const payload = dossier?.payload, understanding = payload?.understanding;
    if (!dossier || !payload || !understanding)
        throw Error("არჩეული ბრენდის ნაწილი აღარ არსებობს. განაახლეთ გვერდი.");
    const version = `${dossier.sessionId}:${dossier.revision}`;
    if (target.type === "business_summary" && target.id === "business-summary")
        return { version, label: "ბიზნესის მოკლე აღწერა", data: { summary: understanding.summary } };
    if (target.type === "positioning" && target.id === "positioning")
        return { version, label: "პოზიციონირება", data: { positioning: understanding.positioning } };
    if (target.type === "audience_hypothesis") {
        const hypothesis = payload.hypotheses.find(item => item.id === target.id);
        if (hypothesis)
            return { version, label: `აუდიტორია: ${hypothesis.name}`, data: { hypothesis } };
    }
    if (target.type === "offer") {
        const index = Number(target.id.match(/^offer-(\d+)$/u)?.[1]) - 1;
        const offer = understanding.offers[index];
        if (offer && index >= 0)
            return { version, label: `შეთავაზება: ${offer.name}`, data: { name: offer.name, description: offer.description } };
    }
    if (target.type === "communication_rule") {
        const index = Number(target.id.match(/^framing-(\d+)$/u)?.[1]) - 1;
        const rule = payload.envelope?.framingRules[index];
        if (rule && index >= 0)
            return { version, label: `საკომუნიკაციო წესი ${index + 1}`, data: { rule, kind: "framing" } };
    }
    throw Error("არჩეული ობიექტი შეიცვალა. განაახლეთ გვერდი და მიმდინარე ვერსია ხელახლა აირჩიეთ.");
}
export type NoteWorkInput = {
    id: string;
    text: string;
    source: NoteEntry['source'];
    context: NoteContext;
};
export type NoteWorkContext = {
    planning: PlanningView;
    dossier: BrandDossier | null;
    strategy: {
        active: {
            payload: {
                proposal: unknown;
            };
        } | null;
    };
    history: NoteEntry[];
    screenData: unknown;
    activeRules: OperatingRule[];
    parentRevisionId?: string | null;
};
export type NoteInterpretationPort=(input:Record<string,unknown>&{message:string;context:NoteContext})=>Promise<Interpretation>;
export async function prepareContextualNote(input: NoteWorkInput, data: NoteWorkContext, ports: {
    reason: BrandReasoner;
    interpret?:NoteInterpretationPort;
    channelImpact: (brandId: string, channel: SocialChannel) => Promise<{
        affectedFuture: number;
        unresolved: number;
    }>;
    channelPolicies: () => Promise<{
        channel: SocialChannel;
        active: boolean;
    }[]>;
}) {
    let context = input.context;
    const { planning, dossier, strategy, history, screenData, activeRules } = data;
    const reason = ports.reason;
    if (context.runId && context.runId !== planning.run?.id)
        throw Error("არჩეული პოსტი ძველ გეგმას ეკუთვნის. განაახლეთ გვერდი და ხელახლა აირჩიეთ.");
    if (context.postVersion && context.postVersion !== planning.posts?.updatedAt)
        throw Error("არჩეული პოსტი შეიცვალა. ხელახლა აირჩიეთ პოსტი და შენიშვნა მიმდინარე ტექსტს მიამაგრეთ.");
    const post = context.postKey ? planning.posts?.payload.outline?.posts[Number(context.postKey.slice(1)) - 1] : null;
    const copy = context.postKey ? planning.posts?.payload.copies[context.postKey] : null;
    if (context.postKey && (!post || !copy || !context.channel || !post.channels.some(c => c.channel === context.channel)))
        throw Error("არჩეული პოსტის ტექსტი ჯერ არ არის მზად ან შეიცვალა.");
    if (context.target) {
        const canonical = resolveCanonicalTarget(context, planning, dossier);
        const canonicalHash = targetHash(canonical.data);
        if (context.target.version !== canonical.version || context.target.hash !== canonicalHash || hash(context.target.data) !== hash(canonical.data))
            throw Error("არჩეული ობიექტი შეიცვალა. განაახლეთ გვერდი და მიმდინარე ვერსია ხელახლა აირჩიეთ.");
        context = { ...context, target: { ...context.target, version: canonical.version, label: canonical.label, hash: canonicalHash, data: canonical.data } };
    }
    const interpretationInput={ message: input.text, context, screenData, selectedTarget: context.target ?? null, selectedPost: post ? { post, copy, channel: context.channel } : null, plan: planning.run?.payload ?? null, brand: dossier?.payload ?? null, strategy: strategy.active?.payload.proposal ?? null, recentConversation: history.filter(n => n.id !== input.id && n.context.postKey === context.postKey && n.context.channel === context.channel).slice(0, 6).reverse().map(n => ({ text: n.text, response: n.message, status: n.status })) };
    const interpretation = ports.interpret ? await ports.interpret(interpretationInput) : await reason<Interpretation>({ step: "contextual_notes", version: "contextual-notes-v2", prompt: `${INTERPRETER_PROMPT}
${WEEKLY_DIRECTIVE_PROMPT}`, schema: INTERPRETATION_V2_SCHEMA,
        input: interpretationInput,
        validate: v => [...((v as Interpretation).statements.some(s => !input.text.includes(s.quote)) ? ["Every quote must be an exact excerpt of the current user message, not history."] : []), ...validateWeeklyDirectives((v as Interpretation).weeklyDirectives, input.text)],
    });
    if(ports.interpret) {
      const schemaFailures=validateSchema(interpretation,INTERPRETATION_V2_SCHEMA)
      if(schemaFailures.length)throw Error('შენიშვნის გაგება დასაზუსტებელია. ცვლილება არ შესრულდა.')
      const failures=[...(interpretation.statements?.some(s=>!input.text.includes(s.quote))?['Quote must come from current original text']:[]),...validateWeeklyDirectives(interpretation.weeklyDirectives,input.text)]
      if(failures.length)throw Error('შენიშვნის გაგება დასაზუსტებელია. ცვლილება არ შესრულდა.')
    }
    let decision = decideNote(interpretation, context);
    if (decision.action === "revise_plan" && (!planning.run || planning.stale || !["ready", "approved"].includes(planning.run.status) || context.week !== currentWeek()))
        decision = { mode: "clarify", action: "none", message: "გეგმა ჯერ მზადდება, მოძველებულია ან სხვა კვირას ეკუთვნის. მიმდინარე გეგმის დასრულების შემდეგ გავაგრძელოთ; შენიშვნა შენახულია." };
    if (decision.action === "revise_brand" && !dossier)
        decision = { mode: "clarify", action: "none", message: "ჯერ ბრენდის გაცნობა დაასრულეთ, შემდეგ მის ინფორმაციას დავაზუსტებთ." };
    let snapshot: NoteSnapshot | null = null;
    if (decision.action === "revise_plan" && planning.run) {
        snapshot = { plan: { runId: planning.run.id, version: planning.run.version, status: planning.run.status, updatedAt: planning.run.updatedAt, priority: planning.run.payload.priority, payloadHash: hash(planning.run.payload) } };
        if (interpretation.weeklyDirectives) {
            const bound = bindWeeklyDirectives({ proposal: interpretation.weeklyDirectives, text: input.text, noteId: input.id,
                target: { brandId: context.brandId, runId: planning.run.id, runVersion: planning.run.version, week: context.week },
                baselineCounts: planning.posts?.payload.outline ? countPostChannels(planning.posts.payload.outline.posts) : undefined });
            if (bound.errors.length)
                decision = { mode: "clarify", action: "none", message: bound.errors.includes("multiWeekPlanningNeedsClarification")
                        ? "რამდენიმე კვირის პირობა შენახულია. ამ ეტაპზე მიმდინარე კვირას ვგეგმავთ; ამ კვირისთვის იგივე პირობები გამოვიყენოთ?"
                        : "რაოდენობის ან პერიოდის ზუსტად განსაზღვრა ვერ მოხერხდა. მიუთითეთ ამ კვირისთვის თითოეულ არხზე საბოლოო რაოდენობა (0–5). შენიშვნა შენახულია." };
            else
                snapshot.weeklyDirectives = bound.directives!;
        }
    }
    if (decision.action === "revise_brand" && dossier)
        snapshot = { brand: { sessionId: dossier.sessionId, revision: dossier.revision, inputNotesHash: hash(dossier.payload.input.notes) } };
    if (decision.action === "set_operating_rule") {
        const rule = interpretOperatingRule(interpretation);
        if (!rule)
            decision = { mode: "clarify", action: "none", message: "მუდმივი წესის ზუსტი ფორმა ან მოქმედების არე ვერ განვსაზღვრეთ. გთხოვთ, ერთი წინადადებით მიუთითოთ წესი და არხი." };
        else
            snapshot = { rule };
    }
    if (decision.action === "set_channel_policy") {
        const change = interpretChannelPolicy(interpretation);
        if (!change)
            decision = { mode: "explain", action: "none", message: "ანგარიშის კავშირის წაშლა ცალკე მოქმედებაა და ამ შენიშვნიდან არ სრულდება." };
        else {
            const [impact, policies] = await Promise.all([ports.channelImpact(context.brandId, change.channel), ports.channelPolicies()]);
            const previousActive = policies.find(policy => policy.channel === change.channel)?.active ?? true;
            snapshot = { channelPolicy: { ...change, previousActive, ...impact } };
            decision = { ...decision, message: `${decision.message}\nმომავალ განრიგში ${impact.affectedFuture} ჩანაწერია: დადასტურების შემდეგ ${impact.affectedFuture - impact.unresolved} უსაფრთხოდ გაუქმდება${impact.unresolved ? `; ${impact.unresolved} ჩანაწერზე გაგზავნა უკვე დაწყებულია, ამიტომ ისინი ავტომატურად არ გაუქმდება` : ""}.` };
        }
    }
    if (decision.action === "revise_post") {
        if (!planning.run || planning.stale || planning.posts?.status !== "ready" || !["ready", "approved"].includes(planning.run.status) || context.week !== currentWeek())
            decision = { mode: "explain", action: "none", message: "შესწორება მხოლოდ მიმდინარე, დასრულებული პოსტისთვის არის შესაძლებელი. განაახლეთ გვერდი და აირჩიეთ მიმდინარე ტექსტი." };
        else {
            const postRules = applicablePostOperatingRules(activeRules, post!.channels);
            const revised = await reason<PostCopy>({ step: "contextual_post_revision", version: "contextual-post-v3", schema: planning.run.payload.publicKnowledge ? POST_COPY_V2_SCHEMA : POST_COPY_SCHEMA, outputLanguage: planning.run.payload.basis.payload.input.language,
                prompt: "Revise ONLY the selected channel of this draft according to the current user instruction. Preserve the post's objective, factual boundaries, format and every unselected channel exactly. Obey every context.operatingRules entry only in its exact scope and communication element; address_form requires semantic Georgian phrasing judgment. Do not invent facts. Do not store a brand preference. Return full copy including unchanged variants.",
                input: { instruction: interpretation.instruction, channel: context.channel, current: copy, context: { ...compilePostGenerationContext(planning.run, post!), operatingRules: postRules.map(rule => ({ kind: rule.kind, effect: rule.effect, parameter: rule.parameter, directive: rule.directive, scope: rule.scope, enforcement: operatingRuleEnforcement(rule) })) } },
                validate: v => [...validateFactualReferences(planning.run!.payload.publicKnowledge, post!.factKeys ?? [], (v as PostCopy).factualReferences), ...validatePostCopy(v as PostCopy, post!), ...(v as PostCopy).variants.filter(variant => variant.channel === context.channel).flatMap(variant => validateVariantOperatingRules(variant, activeRules)), ...((v as PostCopy).variants.filter(p => p.channel !== context.channel).some(p => hash(p) !== hash(copy!.variants.find(old => old.channel === p.channel))) ? ["Unselected channel must remain byte-for-byte unchanged"] : [])],
            });
            snapshot = { ...(planning.posts!.approvedAt ? { revision: { run: planning.run, posts: planning.posts!, parentRevisionId: data.parentRevisionId ?? null } } : {}), post: { runId: planning.run.id, postKey: context.postKey!, channel: context.channel!, batchUpdatedAt: planning.posts!.updatedAt, before: copy!, after: revised } };
        }
    }
    return { context, interpretation, decision, snapshot, status: decision.mode === 'clarify' ? 'clarification' as const : decision.mode === 'explain' ? 'answered' as const : 'proposed' as const };
}
