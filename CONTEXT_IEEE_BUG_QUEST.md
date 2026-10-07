# IEEE Bug Quest — Context & Reference Guide

**Project:** IEEE Inter-Society Code Debugging Challenge (Multi-round tournament)  
**Created:** October 2026  
**Owner:** Tharun (tharun270906@gmail.com)

---

## 1. Project Overview

A **3-round filtering tournament** for debugging competition:
- **Round 1:** 100 participants (1 hour)
- **Round 2:** Top 10 participants
- **Round 3:** Top 3 participants (Finals)

**Concept:** Participants fix buggy code across multiple languages (C++, Java, Python) within time limits.

---

## 2. Round 1 Specifications (FINAL)

### Contest Details
- **HackerRank Link:** https://www.hackerrank.com/ieee-student-branch-2026-bugquest
- **Duration:** 1 hour
- **Total Questions:** 5
- **Total Points:** 240

### Question Breakdown
| Level | Count | Points Each | Total | Languages |
|---|---|---|---|---|
| Easy | 2 | 20 | 40 | C++, Python |
| Moderate | 2 | 50 | 100 | Java, C++ |
| Hard | 1 | 100 | 100 | Java |

### Participant Registration
- Each participant must enter:
  - Department name (CSE, ECE, VLSI, AI&DS, Cyber Security)
  - Roll number

### Tie-Breaking (If 2+ students clear 4+ questions)
1. Time of last accepted submission
2. Hidden test case pass rate
3. Time/Space complexity correctness (code review)

---

## 3. Questions Created

**File:** `/tmp/claude-0/-home-user-HealthcareAI/b6b8b85a-be9a-5708-b3f5-a46ed62d8560/scratchpad/Round1_Questions.md`

### Summary Table
| ID | Name | Language | Level | Points | Concept | Time | Space |
|---|---|---|---|---|---|---|---|
| E1 | Array Sum | C++ | Easy | 20 | Array traversal, off-by-one | O(n) | O(1) |
| E2 | Reverse String | Python | Easy | 20 | String indexing, range() | O(n) | O(n) |
| M1 | Missing Number | Java | Moderate | 50 | Sum technique, loop logic | O(n) | O(1) |
| M2 | Count Pairs | C++ | Moderate | 50 | Two-pointer, sorting | O(n log n) | O(1) |
| H1 | LIS Length | Java | Hard | 100 | DP, max tracking | O(n²) | O(n) |

**Each question includes:**
- Problem statement with example
- Input/Output format & constraints
- Sample test case
- Buggy code (2-4 bugs per question)
- Fixed code
- 4-5 hidden test cases with expected outputs
- Concept explanation
- Time/Space complexity analysis

---

## 4. HackerRank Setup Instructions

### For Each of the 5 Questions:

1. **Navigation:**
   - Go to **Manage Challenges → Create Challenge**

2. **Details Tab:**
   - Challenge Name: `[ID] – [Name]` (e.g., "E1 – Array Sum Calculation")
   - Description: One-liner from question
   - Problem Statement: Copy full statement from Round1_Questions.md
   - Input/Output/Constraints: Copy verbatim
   - Tags: `debugging`, `round1`, `[language]`

3. **Test Cases Tab:**
   - Click **Add Test Case**
   - First test case: Mark as **Sample** (the example from markdown)
   - Add 4-5 hidden test cases from the markdown table
   - Input box: paste test input
   - Expected Output box: paste expected output
   - All tests carry equal weight

4. **Languages Tab:**
   - **Uncheck ALL languages**
   - **Check ONLY** the specified language (C++, Python, or Java)
   - In the **Code Stub / Template** box, paste the **BUGGY CODE** from markdown
   - Participants will see this buggy code in their editor when they open the problem

5. **Settings Tab:**
   - Max Score: 20 (Easy) / 50 (Moderate) / 100 (Hard)
   - Time Limit: Default (2s for C++, 10s for Python/Java)
   - Click **Save**

6. **Verification:**
   - Click **Preview / Try It**
   - Submit **Buggy code** → Should FAIL at least one test
   - Submit **Fixed code** → Should PASS all tests

### Adding Questions to Contest:

1. Go to **Manage Contests → [Your Contest] → Challenges Tab**
2. Click **Add Challenge**
3. Search by name and add all 5 in this order:
   - E1 (Easy)
   - E2 (Easy)
   - M1 (Moderate)
   - M2 (Moderate)
   - H1 (Hard)

---

## 5. Available Resources

### Generated PDFs
- `pdf/SetA_Questions.pdf` — 15 Moderate + 10 Hard (original set)
- `pdf/SetA_AnswerKey.pdf` — With bug explanations
- `pdf/SetB_Questions.pdf` — 18 Easy + 4 Moderate + 3 Hard (easier alternative)
- `pdf/SetB_AnswerKey.pdf` — With concept explanations
- `pdf/HackerRank_Contest_Setup_Guide.pdf` — 11-step guide for general setup

### Scripts
- `build_pdfs.py` — Regenerate PDFs from markdown
  - Run: `python build_pdfs.py` (requires markdown, pygments, playwright)
  - Browser: Chromium at `/opt/pw-browsers/chromium`

### Markdown Files
- `README.md` — Project overview & file structure
- `setA-questions.md` / `setA-answer-key.md` — Original 25 questions
- `setB-questions.md` / `setB-answer-key.md` — Easier 25 questions
- `hackerrank-guide.md` — Detailed HackerRank setup guide

---

## 6. Key Constraints & Rules

### For Participants
- **No AI tools allowed** (ChatGPT, GitHub Copilot, etc.)
- **No browser extensions allowed** (Slider, Monica, etc.)
- Only fix the given code; rewritten solutions may be disqualified
- One login per team (2-3 students per team recommended)
- Department mix encouraged (at least 2 different departments per team)

### For Contest Organizers
- Keep answer keys private until after results announced
- Verify buggy code fails ≥1 test; fixed code passes all
- Spot-check top 10 submissions for "anti-rewrite rule"
- 6-10 hidden tests per question minimum
- Leaderboard visible during contest (optional: hide last 15 minutes)

---

## 7. Contest Day Checklist

- [ ] All 5 challenges created on HackerRank with correct languages
- [ ] Buggy code templates set for each challenge
- [ ] 4-5 hidden test cases per challenge verified
- [ ] Scores set (20, 20, 50, 50, 100)
- [ ] Contest link shared: https://www.hackerrank.com/ieee-student-branch-2026-bugquest
- [ ] Dry run with 3-4 volunteers completed
- [ ] Lab internet allows hackerrank.com access
- [ ] One technical support person + one faculty moderator assigned
- [ ] Rules posted in contest description
- [ ] Participants logged in 30 min before start

---

## 8. Next Steps for Future Sessions

### To Add Questions to HackerRank:
1. Open `/tmp/claude-0/-home-user-HealthcareAI/b6b8b85a-be9a-5708-b3f5-a46ed62d8560/scratchpad/Round1_Questions.md`
2. Follow **Section 4: HackerRank Setup Instructions** above
3. Use the 5-question summary table as reference
4. Each question has:
   - Problem statement (copy to Details tab)
   - Buggy code (copy to Languages template)
   - Test cases (add to Test Cases tab with expected outputs)

### To Create Round 2 & 3:
- Similar format, but filter by top performers from previous round
- Adjust difficulty up if needed
- Keep same 1-hour duration or reduce as appropriate
- Use same HackerRank platform with separate contests

### If Questions Need Revision:
- Edit `/tmp/claude-0/-home-user-HealthcareAI/b6b8b85a-be9a-5708-b3f5-a46ed62d8560/scratchpad/Round1_Questions.md`
- Regenerate buggy/fixed code pairs
- Re-validate with hidden test cases
- Update HackerRank challenges

---

## 9. Contact & Questions

- **Project Owner:** Tharun (tharun270906@gmail.com)
- **Platform:** HackerRank Community Contest (Free)
- **Repository:** `/home/user/HealthcareAI/debugging-challenge/`
- **Session ID:** claude/epic-meitner-qgvfka (development branch)

---

**Document Status:** Final | Last Updated: Oct 7, 2026 | Context Compact
