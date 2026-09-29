#!/usr/bin/env python3
"""
Seed BridgeBoard demo data into the live DynamoDB table.

Writes:
  1. Completed profiles for the dummy team members (with nationality).
  2. Team-pulse updates (ROOM#spring-lab) matching the frontend demo.
  3. A research-room discussion (DISCUSSION) so the room is populated.

Idempotent: uses stable sort keys derived from a content index so
re-running overwrites the same items instead of duplicating them.

Usage:
  python3 scripts/seed_demo_data.py            # dry run (prints plan)
  python3 scripts/seed_demo_data.py --apply     # write to DynamoDB
"""

import argparse
import os
import re
import sys

import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "")
REGION = os.environ.get("AWS_REGION", "us-east-1")
ROOM_ID = "spring-lab"

# Base timestamp for deterministic, ordered demo items (fixed so re-runs
# overwrite the same sort keys). 2026-09-17T12:00:00Z in ms.
BASE_TS = 1789646400000

COLORS = ["purple", "coral", "blue", "gold", "teal", "green"]


def initials(name):
    parts = [p for p in re.split(r"[\s._-]+", name) if p]
    return ("".join(p[0] for p in parts)[:2].upper()) or "R"


def user_id_for(name):
    """Stable synthetic id for a demo member (mirrors backend guest ids)."""
    return "demo-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# --- Dummy member profiles ---
MEMBERS = [
    {
        "name": "Mumtahin Chen",
        "affiliation": "phd",
        "university": "University of Utah",
        "nationality": "United States",
        "researchExperience": "3 years in machine learning robustness and distribution shift.",
    },
    {
        "name": "Jordan Ellis",
        "affiliation": "masters",
        "university": "University of Utah",
        "nationality": "Canada",
        "researchExperience": "ML systems and evaluation pipelines; 2 years building research infrastructure.",
    },
    {
        "name": "Ari Singh",
        "affiliation": "phd",
        "university": "University of Utah",
        "nationality": "India",
        "researchExperience": "Community-engaged research and algorithmic bias; 4 years.",
    },
    {
        "name": "Maria Lopez",
        "affiliation": "postdoc",
        "university": "MIT",
        "nationality": "Spain",
        "researchExperience": "Postdoctoral researcher in dataset curation and fairness.",
    },
    {
        "name": "Chen Wei",
        "affiliation": "professor",
        "university": "Stanford University",
        "nationality": "China",
        "researchExperience": "Faculty in deep learning architectures; 10+ years.",
    },
]

# --- Team pulse updates (ROOM#spring-lab / UPDATE#) ---
UPDATES = [
    ("Mumtahin Chen", "Research", "I ran the latest regression on Dataset B across all seven geographic regions. Performance drops 18% in regions not represented in training data. This strongly supports the distribution-shift hypothesis.", ["#research", "#dataset-b"]),
    ("Jordan Ellis", "Build", "I refactored the evaluation pipeline to split results by region. Architecture A still outperforms Architecture B even on the same dataset, so I think the model design matters too, not just the data.", ["#evaluation", "#architecture"]),
    ("Ari Singh", "Community", "Spoke with Dr. Patel about the geographic bias angle. She suggested we check whether the two training cities in Dataset B have unusual climate patterns that could skew the learned features.", ["#mentor", "#bias"]),
    ("Mumtahin Chen", "Research", "Good point from Ari. I pulled climate metadata for the training cities. One is coastal, one is arid. The seven evaluation regions include temperate and tropical zones not represented at all.", ["#research", "#climate-data"]),
    ("Jordan Ellis", "Build", "I set up an ablation experiment: Architecture B trained on the full 7-region Dataset A. If it still underperforms Architecture A, then the architecture is a factor independent of data distribution.", ["#experiment", "#ablation"]),
    ("Ari Singh", "Community", "The student research group wants to present our preliminary findings at the Friday seminar. I told them we need at least the ablation results first. Can we have those by Thursday?", ["#community", "#deadline"]),
    ("Mumtahin Chen", "Research", "I also noticed Dataset B has 3x fewer samples per region. Sample size could be confounding the geographic effect. We might need to downsample Dataset A to match before comparing.", ["#research", "#confounders"]),
    ("Jordan Ellis", "Build", "Ablation is running now. Estimated 6 hours on the cluster. I added a matched-sample config too so we can test Mumtahin's sample-size hypothesis in the same run.", ["#build", "#cluster"]),
]

# --- Research room discussion (DISCUSSION / MSG#) ---
DISCUSSION = [
    ("Mumtahin Chen", "I think Dataset B performs worse because the training data is geographically concentrated. The model may be seeing a distribution shift when evaluated in new regions."),
    ("Maria Lopez", "I agree that geography may matter. Dataset B contains training measurements from only two cities, while Dataset A covers seven locations."),
    ("Chen Wei", "I am not convinced that dataset distribution is the main cause. Architecture B also performs worse than Architecture A when both are evaluated on Dataset A, so the model architecture may be responsible."),
]

# --- Private rooms and meetings ---

REAL_USER_ID = "demo-portfolio-reviewer"
REAL_USER_NAME = "Portfolio Reviewer"
REAL_USER_INITIALS = "PR"

# (roomId, name, ownerId, demo_member_names)
# The real user Eliza is always appended separately.
PRIVATE_ROOMS = [
    (
        "demo-room-001",
        "Weekly Lab Meeting",
        "demo-mumtahin-chen",
        ["Mumtahin Chen", "Jordan Ellis", "Ari Singh", "Maria Lopez", "Chen Wei"],
    ),
    (
        "demo-room-002",
        "Climate ML Paper Discussion",
        "demo-maria-lopez",
        ["Mumtahin Chen", "Maria Lopez", "Jordan Ellis"],
    ),
    (
        "demo-room-003",
        "Grant Planning - NSF CAREER",
        "demo-mumtahin-chen",
        ["Mumtahin Chen", "Ari Singh"],
    ),
]

# Each meeting dict contains metadata plus speakerTurns as (label, text) tuples.
MEETINGS = [
    # --- Room 1, Meeting 1: Lab Meeting Sep 10 ---
    {
        "roomId": "demo-room-001",
        "meetingId": "demo-mtg-001",
        "title": "Lab Meeting - Sep 10",
        "meetingType": "physical",
        "date": "2026-09-10",
        "location": "Patel Lab Conference Room",
        "createdBy": "demo-mumtahin-chen",
        "tsOffset": -604800000,  # 7 days before BASE_TS
        "speakerNames": {
            "spk_0": "Mumtahin",
            "spk_1": "Jordan",
            "spk_2": "Ari",
            "spk_3": "Maria",
            "spk_4": "Chen Wei",
            "spk_5": "Eliza",
        },
        "speakerTurns": [
            ("spk_0", "All right, let us get started. Thanks everyone for being here. First item on the agenda is reviewing results from last week's geographic bias experiments. Jordan, you ran the updated evaluation pipeline, right?"),
            ("spk_1", "Yes. So I ran Architecture A and Architecture B on both datasets with the new region-stratified splits. The headline result is that Architecture A maintains consistent accuracy across all seven regions in Dataset A, with less than two percent variance. But Architecture B drops by up to eighteen percent in underrepresented regions."),
            ("spk_3", "That eighteen percent figure, is that on Dataset A or Dataset B?"),
            ("spk_1", "That is on Dataset B specifically. On Dataset A, Architecture B still underperforms A, but the gap is smaller, around six to eight percent. The geographic variance is much worse when the training data is concentrated."),
            ("spk_0", "This supports what we hypothesized. The interaction between limited geographic coverage in the training set and the architecture's capacity to generalize is the key driver. It is not purely a data problem or purely a model problem."),
            ("spk_2", "I want to flag something from my conversation with Dr. Patel last week. She pointed out that the two training cities in Dataset B, Phoenix and Miami, have unusually extreme climate profiles. One is arid desert, the other is subtropical. The evaluation regions include temperate continental zones that neither city represents well."),
            ("spk_4", "That is a critical confound. If the training distribution is biased along a climate axis that correlates with geography, we cannot cleanly separate geographic bias from climate-type bias. We may need a more fine-grained feature analysis."),
            ("spk_5", "Could we look at the learned feature representations directly? If we extract intermediate activations for samples from different regions, we might see whether the model is clustering by geography or by underlying climate variables."),
            ("spk_0", "That is a great idea. We could do a t-SNE or UMAP visualization of the penultimate layer activations, colored by region and also by climate zone. If the clusters align with climate rather than geography, that tells us something important."),
            ("spk_3", "I can help set that up. I have code from a previous project that does exactly this kind of representation analysis. We would need to define the climate zone labels for each region though."),
            ("spk_2", "I can handle the climate zone mapping. The Koppen classification system gives us a standard taxonomy. I will pull the classifications for all seven regions and the two training cities by end of day tomorrow."),
            ("spk_1", "On the ablation front, I also ran Architecture B trained on the full seven-region Dataset A. It still underperforms Architecture A by about four percent overall, but the geographic variance drops to three percent, which is much closer to Architecture A's two percent."),
            ("spk_4", "So the architecture contributes a baseline performance gap, but the geographic disparity is primarily data-driven. That is a clean result. We should highlight this decomposition in the paper."),
            ("spk_0", "Agreed. Let me also mention the observation from last week about sample sizes. Dataset B has roughly three times fewer samples per region compared to Dataset A. Jordan, did the matched-sample experiment finish?"),
            ("spk_1", "It did. When I downsample Dataset A to match Dataset B's per-region sample counts, Architecture A's geographic variance increases from two percent to about seven percent. So sample size is definitely a contributing factor, but it does not fully explain the eighteen percent gap."),
            ("spk_5", "So we have three contributing factors: architecture choice, geographic coverage of training data, and sample size per region. Do we have a sense of the relative contribution of each?"),
            ("spk_0", "Roughly, I would say architecture accounts for about four percentage points, sample size for about five to seven, and geographic coverage for the remaining six to seven. But those are back-of-the-envelope estimates. We need a more rigorous decomposition."),
            ("spk_3", "I think we should write this up as a variance decomposition analysis. Factor out each variable systematically. That would be a strong contribution to the paper."),
            ("spk_4", "I agree. A proper ANOVA-style decomposition would be publishable on its own. Let us prioritize that analysis this week. Mumtahin, can you lead the design?"),
            ("spk_0", "Absolutely. I will draft the experimental design for the decomposition by Thursday. Jordan, can you have the compute resources ready? We will need several training runs."),
            ("spk_1", "I will reserve a GPU allocation on the cluster. Should be able to get us a forty-eight hour block starting Friday."),
        ],
    },
    # --- Room 1, Meeting 2: Lab Meeting Sep 3 ---
    {
        "roomId": "demo-room-001",
        "meetingId": "demo-mtg-002",
        "title": "Lab Meeting - Sep 3",
        "meetingType": "physical",
        "date": "2026-09-03",
        "location": "Patel Lab Conference Room",
        "createdBy": "demo-mumtahin-chen",
        "tsOffset": -1209600000,  # 14 days before BASE_TS
        "speakerNames": {
            "spk_0": "Mumtahin",
            "spk_1": "Jordan",
            "spk_2": "Ari",
            "spk_3": "Maria",
            "spk_4": "Chen Wei",
            "spk_5": "Eliza",
        },
        "speakerTurns": [
            ("spk_0", "Welcome back everyone. Today I want to focus on our dataset comparison methodology. We have been going back and forth on how to fairly compare performance across Dataset A and Dataset B, and I think we need to lock down our approach."),
            ("spk_3", "I reviewed the literature on cross-dataset evaluation over the weekend. The standard approach is to train on each dataset separately and evaluate on a shared held-out test set. But our datasets have different geographic distributions, which complicates that."),
            ("spk_4", "The fundamental question is whether we want to measure dataset quality or model robustness. If we train on Dataset A and evaluate on Dataset B's distribution, we are testing robustness. If we evaluate both on the same distribution, we are testing dataset quality."),
            ("spk_0", "I think we need both analyses. The paper's central claim is about geographic bias, so we need to show both that the datasets differ in their geographic coverage and that this difference has measurable downstream effects on model performance."),
            ("spk_1", "From a practical standpoint, I can set up both evaluation protocols. But we need to agree on the stratification scheme. Do we split by country, by region, by climate zone, or something else?"),
            ("spk_2", "I would argue for a multi-level stratification. Region gives us the broadest picture, but climate zone captures the underlying environmental variation that might actually drive the performance differences."),
            ("spk_5", "What about the granularity of our region labels? Some of the regions in Dataset A are quite large. If we treat all of Southeast Asia as one region, we might be hiding variation within that area."),
            ("spk_3", "That is a valid concern. The Koppen system actually gives us sub-classifications. We could use the primary classification for the main analysis and report sub-classification results in the supplement."),
            ("spk_0", "Good. Let us go with primary Koppen zones for the main text and sub-zones for supplementary analysis. Now, for task assignments. Jordan, can you implement the dual evaluation pipeline?"),
            ("spk_1", "Yes. I will have the cross-dataset evaluation framework ready by Friday. I will also add region-stratified metrics to the output automatically."),
            ("spk_0", "Maria, can you compile the geographic and climate metadata for both datasets? We need to know exactly which locations are represented and their climate classifications."),
            ("spk_3", "I will have a complete metadata table by Wednesday. I also want to check whether the original dataset papers report any known geographic biases."),
            ("spk_2", "I will follow up with Dr. Patel about the community engagement angle. She mentioned there are researchers in the global south working on similar bias questions. It would be good to cite their work and potentially reach out for feedback."),
            ("spk_4", "On my end, I will review the architecture comparison methodology. I want to make sure our Architecture A versus B comparison is not confounded by differences in model capacity or training hyperparameters."),
            ("spk_5", "I can help with the hyperparameter matching. I have some experience with fair model comparisons from my previous work on benchmark standardization."),
            ("spk_0", "That would be great, Eliza. Can you and Chen Wei draft a controlled experimental setup by next week? We want to isolate architecture effects from training configuration effects."),
            ("spk_5", "Absolutely. I will start by listing all the hyperparameters that differ between the two architectures and propose a normalization strategy."),
            ("spk_4", "Good. We should also decide on a fixed compute budget for each model. Equal training FLOPs is a common approach, though not perfect."),
            ("spk_0", "Let us go with matched FLOPs as the primary comparison and report wall-clock-matched results as a secondary analysis. Any other items for today?"),
            ("spk_1", "Just a quick note: I upgraded the cluster scheduler. Jobs should start faster now. I also added automatic checkpointing every two hours, so we will not lose progress if a node goes down."),
        ],
    },
    # --- Room 2: Paper Draft Review ---
    {
        "roomId": "demo-room-002",
        "meetingId": "demo-mtg-003",
        "title": "Paper Draft Review - Geographic Bias",
        "meetingType": "zoom",
        "date": "2026-09-12",
        "location": "Zoom",
        "createdBy": "demo-maria-lopez",
        "tsOffset": -432000000,  # 5 days before BASE_TS
        "speakerNames": {
            "spk_0": "Maria",
            "spk_1": "Mumtahin",
            "spk_2": "Jordan",
            "spk_3": "Eliza",
        },
        "speakerTurns": [
            ("spk_0", "Thanks for jumping on. I circulated the latest draft last night. I think we are in good shape for the introduction and methods sections, but I have concerns about the results figures and the discussion."),
            ("spk_1", "I read through it this morning. The writing is strong, but I agree about the figures. Figure three in particular, the geographic performance heatmap, is hard to read. The color scale does not clearly distinguish between regions with moderate and severe performance drops."),
            ("spk_2", "I noticed that too. I think we should switch from a continuous color scale to a diverging one centered on the mean performance. That way, above-average and below-average regions are immediately visible."),
            ("spk_3", "Could we also add small multiples? Instead of one crowded heatmap, show separate panels for each architecture-dataset combination. Four panels would be much easier to parse than one overloaded figure."),
            ("spk_0", "I like that approach. Four panels, each with the diverging color scale. Jordan, can you regenerate those figures?"),
            ("spk_2", "Sure. I will have updated figures by tomorrow evening. Should I also update the scatter plot in Figure five? The axis labels are a bit cryptic right now."),
            ("spk_0", "Yes, please. Use full descriptive labels. We cannot assume reviewers will read the caption carefully. Now, about the discussion section. I think we are underselling the practical implications."),
            ("spk_1", "I agree. The discussion currently reads like a summary of results. We need to connect our findings to the broader AI fairness conversation. Geographic bias in climate models has real-world consequences for vulnerable communities."),
            ("spk_3", "Maybe we should add a subsection on recommendations for dataset curators. Something concrete like minimum geographic coverage requirements or stratified sampling guidelines."),
            ("spk_0", "That is excellent. A practical recommendations subsection would strengthen the paper significantly. It moves us from just identifying a problem to proposing solutions."),
            ("spk_1", "We should also address the reviewer who flagged the sample size confound in our workshop version. Now that we have the matched-sample analysis, we can directly respond to that criticism."),
            ("spk_2", "I can add a paragraph in the results section specifically comparing the full-sample and matched-sample results. That makes the rebuttal argument self-contained within the paper."),
            ("spk_0", "Good. Let us also think about the related work section. I found three new papers published in the last month on geographic bias in different domains. One is about agricultural yield prediction, one about urban heat island modeling, and one about wildfire risk assessment."),
            ("spk_3", "Those are all highly relevant. They show that geographic bias is a systemic issue across climate ML applications, not unique to our domain. That strengthens our argument for why this work matters."),
            ("spk_1", "I can integrate those citations. We should frame our work as part of this emerging body of evidence. Are we targeting NeurIPS or ICML for submission?"),
            ("spk_0", "I think NeurIPS is the better venue given the dataset and evaluation focus. The deadline is in six weeks. If we finalize the figures this week and the text next week, that gives us two weeks for internal review and one week buffer."),
            ("spk_2", "That timeline works for me. I will prioritize the figure updates."),
            ("spk_3", "I can do a detailed editing pass on the full draft next week once the figures are updated."),
            ("spk_0", "Perfect. Let us plan to have the final internal draft ready by October first. I will set up a shared editing session for that week."),
        ],
    },
    # --- Room 3: NSF CAREER Aim 2 ---
    {
        "roomId": "demo-room-003",
        "meetingId": "demo-mtg-004",
        "title": "NSF CAREER Aim 2 Discussion",
        "meetingType": "zoom",
        "date": "2026-09-14",
        "location": "Zoom",
        "createdBy": "demo-mumtahin-chen",
        "tsOffset": -259200000,  # 3 days before BASE_TS
        "speakerNames": {
            "spk_0": "Mumtahin",
            "spk_1": "Ari",
            "spk_2": "Eliza",
        },
        "speakerTurns": [
            ("spk_0", "Thanks for meeting on short notice. The NSF CAREER proposal is due in five weeks and I need to solidify Aim 2. The program officer feedback suggested we need a clearer connection between the technical work and broader impacts."),
            ("spk_1", "Remind me of the aim structure. Aim 1 is the technical foundation for geographic bias detection, right?"),
            ("spk_0", "Yes. Aim 1 develops methods for detecting and quantifying geographic bias in climate ML models. Aim 2 is supposed to be about mitigation strategies, but the feedback said it felt too incremental. They want something more ambitious."),
            ("spk_2", "What if Aim 2 focuses on creating a benchmark framework rather than just mitigation? Something like a standardized geographic bias evaluation suite that other researchers can use to test their own models."),
            ("spk_0", "I like that direction. A benchmark suite has more lasting impact than a single mitigation technique. We could call it something like GeoClimate-Bench or GeoBias-Eval."),
            ("spk_1", "From the community engagement perspective, a benchmark could also involve collaboration with researchers from underrepresented regions. They could contribute evaluation data from their local contexts, making the benchmark truly global."),
            ("spk_0", "That connects beautifully to the broader impacts. We could frame Aim 2 as both a technical contribution and a community-building effort. The benchmark development itself becomes a mechanism for including diverse voices."),
            ("spk_2", "For the preliminary results section, we already have the variance decomposition analysis. That demonstrates we can systematically identify the sources of geographic bias. We could present that as proof of concept for the benchmark metrics."),
            ("spk_1", "We should also mention the partnership with Dr. Patel's group. NSF loves to see existing collaborations that will be deepened by the proposed work."),
            ("spk_0", "Good point. I will frame the Patel collaboration as the seed for a broader network of geographic bias researchers. Now, let us talk about budget. The original budget allocated sixty percent to Aim 1. If Aim 2 is now more ambitious, we may need to rebalance."),
            ("spk_2", "What are the main cost drivers for the benchmark suite? I would guess data collection and annotation, plus compute for running the evaluation experiments."),
            ("spk_0", "Exactly. Data collection is the biggest expense. If we want to include data from at least fifteen geographic regions with proper quality control, we are looking at significant personnel costs for data curation."),
            ("spk_1", "Could we budget for undergraduate research assistants from partner institutions? That reduces per-person costs while also supporting the broader impacts narrative of training a diverse workforce."),
            ("spk_0", "That is clever. REU supplements could cover some of that, but we should budget the core costs in the main proposal. I am thinking a fifty-fifty split between Aim 1 and Aim 2 with a shared infrastructure budget."),
            ("spk_2", "For the compute side, we could leverage the university cluster for most experiments but budget for cloud compute for the larger benchmarking runs. AWS or Google Cloud credits through their academic programs could stretch the budget."),
            ("spk_0", "Let me also bring up the timeline. NSF CAREER proposals need a five-year plan. I am thinking Years 1 and 2 for Aim 1, Years 2 through 4 for Aim 2 with overlap, and Year 5 for synthesis and dissemination."),
            ("spk_1", "The community engagement component should run throughout all five years though. We should start building the collaborator network in Year 1 even while the technical work is still focused on Aim 1."),
            ("spk_2", "Agreed. Early engagement means the benchmark will be designed with input from diverse stakeholders from the beginning, not retrofitted after the fact."),
            ("spk_0", "Perfect. Let me draft the revised Aim 2 narrative this week. Ari, can you write up the community engagement plan? And Eliza, can you draft the benchmark technical specification, just a rough outline of what metrics and datasets we would include?"),
            ("spk_1", "I will have the community plan drafted by Monday. I will also reach out to two potential collaborators in Brazil and Kenya that I met at the ICML workshop."),
            ("spk_2", "I will have the technical spec outline ready by Monday as well. I will base it on our existing evaluation pipeline and extend it to cover the multi-region benchmark scenarios."),
        ],
    },
]


def build_items():
    items = []

    # 1. Member profiles
    for m in MEMBERS:
        uid = user_id_for(m["name"])
        items.append({
            "pk": f"USER#{uid}",
            "sk": "PROFILE",
            "entity": "user-profile",
            "userId": uid,
            "displayName": m["name"],
            "university": m["university"],
            "affiliation": m["affiliation"],
            "nationality": m["nationality"],
            "researchExperience": m["researchExperience"],
            "email": "",
            "initials": initials(m["name"]),
            "createdAt": BASE_TS,
            "updatedAt": BASE_TS,
            "demoSeed": True,
        })

    # 2. Team pulse updates
    for i, (name, role, text, tags) in enumerate(UPDATES):
        uid = user_id_for(name)
        ts = BASE_TS + i * 1000
        color = COLORS[sum(ord(c) for c in uid) % len(COLORS)]
        items.append({
            "pk": f"ROOM#{ROOM_ID}",
            "sk": f"UPDATE#{ts}#demo{i:02d}",
            "id": f"demo-update-{i:02d}",
            "entity": "update",
            "roomId": ROOM_ID,
            "userId": uid,
            "name": name,
            "initials": initials(name),
            "role": role,
            "color": color,
            "time": "earlier today",
            "text": text,
            "tags": tags,
            "reactions": 0,
            "createdAt": ts,
            "demoSeed": True,
        })

    # 3. Research discussion messages
    for i, (name, text) in enumerate(DISCUSSION):
        uid = user_id_for(name)
        ts = BASE_TS + 100000 + i * 1000
        color = COLORS[sum(ord(c) for c in uid) % len(COLORS)]
        items.append({
            "pk": "DISCUSSION",
            "sk": f"MSG#{ts}#demo{i:02d}",
            "id": f"demo-msg-{i:02d}",
            "entity": "discussion-message",
            "userId": uid,
            "speaker": name,
            "initials": initials(name),
            "color": color,
            "text": text,
            "reactions": {},
            "createdAt": ts,
            "demoSeed": True,
        })

    # 4. Private room meta and memberships
    room_ts = BASE_TS - 2592000000  # rooms created 30 days before BASE_TS
    for room_id, room_name, owner_id, demo_member_names in PRIVATE_ROOMS:
        # Build member list: demo members + real user
        members_list = []
        for mname in demo_member_names:
            uid = user_id_for(mname)
            members_list.append({
                "userId": uid,
                "name": mname,
                "initials": initials(mname),
            })
        members_list.append({
            "userId": REAL_USER_ID,
            "name": REAL_USER_NAME,
            "initials": REAL_USER_INITIALS,
        })

        # Room meta item
        items.append({
            "pk": f"PRIVROOM#{room_id}",
            "sk": "META",
            "entity": "private-room",
            "roomId": room_id,
            "name": room_name,
            "ownerId": owner_id,
            "members": members_list,
            "createdAt": room_ts,
            "demoSeed": True,
        })

        # Room membership items (one per member)
        for member in members_list:
            items.append({
                "pk": f"USER#{member['userId']}",
                "sk": f"ROOM#{room_id}",
                "entity": "room-membership",
                "roomId": room_id,
                "name": room_name,
                "ownerId": owner_id,
                "createdAt": room_ts,
                "demoSeed": True,
            })

    # 5. Meetings with transcripts
    for mtg in MEETINGS:
        ts = BASE_TS + mtg["tsOffset"]
        speaker_turns = [
            {"speaker": spk, "text": txt}
            for spk, txt in mtg["speakerTurns"]
        ]
        transcript = "\n".join(
            f"{mtg['speakerNames'][spk]}: {txt}"
            for spk, txt in mtg["speakerTurns"]
        )
        items.append({
            "pk": f"PRIVROOM#{mtg['roomId']}",
            "sk": f"MEETING#{ts}#{mtg['meetingId']}",
            "entity": "meeting",
            "roomId": mtg["roomId"],
            "meetingId": mtg["meetingId"],
            "title": mtg["title"],
            "meetingType": mtg["meetingType"],
            "date": mtg["date"],
            "location": mtg["location"],
            "createdBy": mtg["createdBy"],
            "createdAt": ts,
            "transcript": transcript,
            "speakerTurns": speaker_turns,
            "speakerNames": mtg["speakerNames"],
            "demoSeed": True,
        })

    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write to DynamoDB")
    args = parser.parse_args()

    items = build_items()

    print(f"Planned items: {len(items)}")
    for it in items:
        print(f"  {it['pk']:32}  {it['sk']}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return

    if not TABLE_NAME:
        raise SystemExit("Set TABLE_NAME to your DynamoDB table before using --apply.")

    table = boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME)

    with table.batch_writer() as batch:
        for it in items:
            batch.put_item(Item=it)

    print(f"\nWrote {len(items)} demo items.")


if __name__ == "__main__":
    sys.exit(main())
