# Two mock interviews

Run each as a real 45 minutes: a friend (or you, recording) reads the **prompts**, asks the **follow-ups** whatever you answer, and fills in the score sheet. Don't open the code during a mock. Afterwards, open it and check every claim you made.

---

## Mock 1: React / Redux (45 min)

**Warm-up (5 min)**
1. Tell me about a project you're proud of. *(Use the 2-minute pitch.)*
2. Why did you also build it in Angular? *(Follow-up: one thing Angular does better, one thing React does better.)*

**Fundamentals (10 min)**
3. What happens between `setState` and the screen updating? *(Follow-up: why do three `setCount(count + 1)` calls add only 1?)*
4. Why can't the list key be the index? *(Follow-up: when is the index fine? A static list that never reorders.)*
5. Controlled vs uncontrolled inputs: which did you use with react-hook-form, and why?

**Hooks (10 min)**
6. Write, on paper, a `useDebouncedValue(value, ms)` hook. *(Follow-up: what does the cleanup do here?)*
7. Your search shows results for an *old* term after typing fast. Why? Fix it. *(The answer: abort/ignore stale responses.)*
8. A component re-renders too often. How do you find out, and what do you change? *(Follow-up: why didn't `React.memo` alone fix it?)*

**State management (10 min)**
9. Context vs Redux Toolkit vs RTK Query: what goes where in your app?
10. Explain tags and invalidation with an example from the admin screen.
11. Draw what happens when five requests get a 401 at the same moment. *(Single-flight refresh. Follow-up: what would the server do if two refreshes used the same token?)*

**Routing and auth (7 min)**
12. A customer opens `/admin`. Walk me through it. *(Follow-up: "so the route guard is your security?" The answer is no.)*
13. Where are the tokens stored, and what would you change for a bank?

**Wrap-up (3 min)**
14. What would you refactor first if you had another week?

---

## Mock 2: .NET / Security (45 min)

**Warm-up (5 min)**
1. Draw the architecture. *(Follow-up: where does the request pass through CORS, and why there?)*

**API design (10 min)**
2. Design `POST /api/orders`: request, response, status codes. *(Follow-up: what does the client NOT send, and why?)*
3. How do your errors look to a client? *(Follow-up: what does a 500 contain, and what must it never contain?)*
4. DI lifetimes: what's a captive dependency, and how would you notice it?

**Data (10 min)**
5. How do you know there's no N+1? *(Expect: "a test counts the SQL commands".)*
6. Two admins edit the same product. What happens? *(Follow-up: how does the client learn which version it has?)*
7. A product is deleted. What happens to old orders that contain it? *(Soft delete + snapshot.)*
8. Why not run migrations on startup in production?

**Security (15 min)**
9. List everything you validate on a JWT. *(Follow-up: what's the `alg: none` attack? What's wrong with the default 5-minute clock skew?)*
10. A refresh token is stolen. What limits the damage? *(Hash at rest, rotation, reuse detection revokes everything, 7-day lifetime.)*
11. How do you stop password guessing? *(Lockout + rate limit. Follow-up: behind a load balancer, why could the rate limit break, and how did you fix it? Forwarded headers, trusted only from the proxy.)*
12. What do your security headers do? Which would break your SPA if set wrong? *(CSP vs inline scripts: Angular's critical-CSS `onload`.)*
13. A customer changes the order id in the URL. *(Row-level filtering by the token's user id, so they get a 404, not someone else's order.)*

**Ops (5 min)**
14. Production returns 500 for one user. Go. *(Correlation id → logs → reproduce in a test.)*
15. Liveness vs readiness: what does each check, and what happens when each fails?

---

## Score sheet (per answer, 0–2)

| | 0 | 1 | 2 |
|---|---|---|---|
| **Correct** | wrong or vague | right but incomplete | right and precise |
| **Grounded** | generic theory | mentions the project | points to the file **and** the test |
| **Trade-off** | none | names an alternative | says *why not* the alternative |
| **Security-aware** (where it applies) | ignores it | mentions it | says where it's **enforced** |

Target: an average of **1.5+** in each column. Any 0 on a security question goes onto tomorrow's practice list: re-read the matching section in [01-questions.md](01-questions.md) and run its drill.

## Common traps (from the plan's mistakes list)
- Treating hidden UI as security.
- "JWTs are encrypted": they're **signed**, and anyone can read the payload.
- "CORS protects my API": it protects *browsers*. curl ignores it.
- Storing derived state, or index keys.
- Answering *what* without *why*: always add the trade-off.
