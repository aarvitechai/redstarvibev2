# Phase 16: Interview Readiness

This phase adds no new features. Instead, it turns the 15 phases you built into answers you can **say out loud and prove**. Every answer points to code in this repo and to a test that shows it's true. "I built it, and here's the test" beats any textbook answer.

## The material

| File | Use it for |
|---|---|
| [01-questions.md](01-questions.md) | Q&A in the plan's order: React → Hooks → Router/Auth → Redux vs Context → RTK Query → .NET API → EF Core/Identity/JWT → system design → debugging → deployment. Each has the Angular counterpart |
| [02-scenario-drills.md](02-scenario-drills.md) | The 8 drills (slow list, stale table, security, `/admin` by URL, CORS, pagination, deployment, out-of-sync state), each with a model answer |
| [03-architecture-and-walkthrough.md](03-architecture-and-walkthrough.md) | The diagram to draw from memory, the **2-minute** pitch, and the **5-minute** end-to-end walkthrough (the checkpoint) |
| [04-mock-interviews.md](04-mock-interviews.md) | Two 45-minute mocks (React/Redux; .NET/security) with follow-ups and a scoring sheet |

## The answer structure (use it for every design question)

1. **Clarify.** Who uses it, how much data, what "done" means. Ask one or two questions and don't start drawing yet.
2. **Data flow.** Browser → client state → HTTP → API → database, and back. Name each hop.
3. **Trade-offs.** At least one rejected option and why. ("I didn't use X because…")
4. **Security.** Who may do this? Where is that **enforced**? (Always the server.)
5. **Testing.** How you'd prove it works, and which test would catch a regression.

## How to practise

1. **Read a question, close the file, answer out loud** (record yourself; 60–90 seconds per answer).
2. Compare with the model answer. Write down what you missed in one line.
3. **Prove it:** run the drill. These are the tests in all three stacks behind the answer:
   ```bash
   npm run drill                  # list the drills
   npm run drill -- security      # run one (add --only api|react|angular)
   ```
4. Open the test and explain **why it exists**: which bug or attack it stops.
5. Day 1: questions + drills. Day 2: both mocks, then the 5-minute walkthrough until it fits the time.

## Checkpoint

Explain the full project end to end in about **five minutes** (script in [03](03-architecture-and-walkthrough.md)), and draw the architecture from memory in two. If you can answer every drill without notes, and `npm run drill -- <name>` passes for each, Phase 16 is done.
