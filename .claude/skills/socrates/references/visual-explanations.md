# Visual Explanations

Use this reference for HTML artifacts, picture explainers, code or module walkthroughs, trade-off maps, incident explanations, and other requests where relationships are easier to see than read.

## Choose the visual surface

Use the best surface the host already provides:

1. An in-conversation artifact or visualization when available.
2. A self-contained HTML artifact when the user asks for ELI5, a picture explainer, an artifact, or a reusable walkthrough.
3. An inline diagram, timeline, state map, tree, or comparison when an artifact surface is unavailable.

Do not create files in the user's repository merely because HTML would look nicer. A requested file is a deliverable; an unrequested repository mutation is not.

## Make the big picture readable

A strong visual explanation usually has:

- a title phrased as the question being answered;
- one sentence that states the whole model;
- numbered sections that reveal the flow in a useful order;
- large, simple diagrams with short labels;
- arrows labeled with the event, data, decision, or cause that crosses them;
- consistent colors or shapes for the same roles;
- a short consequence or caveat directly below the relevant diagram.

Prefer progressive visual storytelling over one dense architecture diagram. Keep prose sparse, but do not remove terms the learner needs in order to discuss the real system.

## HTML artifact rules

When producing HTML:

- make it self-contained and responsive;
- use HTML, CSS, and inline SVG or simple shapes before raster images;
- avoid external scripts, fonts, trackers, network requests, or runtime dependencies;
- preserve readable text contrast, keyboard access for real controls, and text labels for meaning conveyed by color;
- use interaction only when it teaches something, such as stepping through a flow or switching between two cases;
- keep the explanation usable without interaction;
- give the artifact a clear filename when a file was requested.

The artifact is a teaching surface, not decoration. Do not spend visual complexity on gradients, ornamental cards, or animation that does not clarify the model.

## Ground technical visuals

For code or system explanations, inspect the source first and attach labels to evidence:

- distinguish current behavior from a proposal;
- show data, control, and failure paths accurately;
- name important boundaries such as process, service, database, queue, or user action;
- show preserved invariants beside the step where they matter;
- mark unknown or inferred links instead of drawing them as facts.

For an incident, separate the trigger, propagation path, user-visible impact, recovery, and unresolved uncertainty. For a trade-off, put both benefits and costs on the same causal map.

## Repair the visual after a miss

If the learner's answer is not aligned, do not add another full-page explanation. Replace or isolate the part they misunderstood:

- zoom into one arrow or boundary;
- contrast two nearly identical cases;
- redraw the sequence as a timeline;
- turn an abstract relationship into a concrete state change;
- remove unrelated branches;
- label the exact condition that changes the outcome.

Then ask one focused question about that revised visual and stop.
