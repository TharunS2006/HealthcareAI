# IEEE Inter-Society Code Debugging Challenge — Organizer Guide

**Organized by:** IEEE Computational Intelligence Society (CIS) with the IEEE Computer Society, Signal Processing Society, Circuits & Systems Society and the student security chapter

**Participants:** CSE, ECE, Cyber Security, AI & DS, VLSI
**Questions:** 25 (15 Moderate + 10 Hard)
**Languages:** C++, Python, Java
**Platforms:** free contest hosting on HackerRank Community, with HackerEarth / CodeChef / Codeforces Gym as alternatives

Files:
- `README.md`: this guide (format, department grouping, scoring, hosting steps)
- `questions.md`: what participants see (statements plus buggy code)
- `answer-key.md`: bugs and fixed code. **Keep this file private.** If this repository is public, remove it before the event, or move it somewhere private.

---

## 1. Department grouping

Every question is tagged with the IEEE society and the department whose syllabus it comes from, so every group gets questions on familiar ground:

| Group | Departments | IEEE societies | Themes |
|---|---|---|---|
| **G1: Computing** | CSE, AI & DS | Computer Society, CIS | Algorithms, data structures, ML basics |
| **G2: Electronics** | ECE, VLSI | Signal Processing Society, Circuits & Systems Society | Filters, bits, parity, binary arithmetic |
| **G3: Security** | Cyber Security | Computer Society (security) | Ciphers, RSA, password checks |

**Recommended format: mixed teams of 2–3.** Each team has one member from at least two different groups, and all teams solve the same 25 questions. This keeps the event inter-departmental and fair.
*Alternative:* individual entry with one leaderboard, using the department tag only for "best in department" prizes.

### Question distribution

| Level | Total | C++ | Python | Java | G1 | G2 | G3 |
|---|---|---|---|---|---|---|---|
| Moderate | 15 | 5 | 5 | 5 | 8 | 4 | 3 |
| Hard | 10 | 4 | 3 | 3 | 6 | 3 | 1 |
| **Total** | **25** | **9** | **8** | **8** | 14 | 7 | 4 |

## 2. Rules & scoring

- Duration: **2 h 30 min**.
- Each problem gives buggy code in **one fixed language**. Participants must fix that code (usually 2–4 bugs). Only that language is enabled for the problem.
- Moderate = **50 pts**, Hard = **100 pts**. Total = 15×50 + 10×100 = **1750**.
- Hidden test cases give partial credit (score ∝ tests passed).
- Tie-break: earliest time of last accepted submission (the platform does this automatically).
- **Anti-rewrite rule:** a submission must stay structurally close to the given code. Rewritten solutions can be disqualified at review. Judges spot-check top-10 submissions against the original. Announce this rule before the contest.
- Internet, AI tools and phones are not allowed. If possible, run the contest in a lab and use the platform's tab-switch / proctoring options.

## 3. Hosting for free

### Option A: HackerRank Community Contests (recommended)
1. Log in at **hackerrank.com** → profile menu → **Administration** → **Manage Contests** → **Create Contest**. Contest hosting for communities and colleges is free.
2. Set the name, start/end time and a custom URL. Leave the leaderboard on.
3. **Manage Challenges → Create Challenge** for each question:
   - Paste the *Problem statement, Input/Output format, Constraints and Sample* from `questions.md`.
   - **Test cases tab:** add the sample (marked sample) plus 6–10 hidden cases. Generate outputs by running the fixed code from `answer-key.md` locally.
   - **Languages tab:** enable **only** the problem's language (e.g. only Python 3).
   - **Code stubs / Template:** paste the **buggy code** as the default template for that language so it loads in the editor automatically.
   - Set the score (50 / 100).
4. Add all 25 challenges to the contest, then use **Moderators** to add faculty.
5. Under **Advanced settings** you can turn on tab-switch detection and copy-paste restriction if they're available for your account.
6. Share the contest link and give participants a dry run with a dummy contest a day before.

### Option B: HackerEarth
HackerEarth also lets colleges and communities host coding contests (look for **Host / Organize a challenge** under your profile). Problem setup is the same: statement, test cases, language restriction, and the buggy code as the default code template. Free availability depends on account type, so confirm a week in advance.

### Option C: CodeChef "Host Your Own Contest" / Codeforces Gym
- **CodeChef** offers free contest hosting for educational institutions (apply from codechef.com → Host contest; approval takes a few days).
- **Codeforces:** create the problems in **Polygon** (polygon.codeforces.com) and run them as a **Mashup/Gym** contest, which is free. Put the buggy code inside the statement, since Codeforces has no editor stubs.

> HackerRank is easiest for a debugging contest because it can pre-load buggy code into the editor per language.

## 4. Preparation checklist
- [ ] Faculty review of all 25 questions (statement ↔ fixed code ↔ tests)
- [ ] For each problem, generate hidden tests by running the fixed code, including edge cases (n=1, zeros, negatives, max sizes)
- [ ] Verify the buggy code **fails** at least one hidden test and the fixed code **passes** all of them
- [ ] Restrict languages per problem
- [ ] Dry-run contest with volunteers
- [ ] Keep `answer-key.md` private until results are announced
